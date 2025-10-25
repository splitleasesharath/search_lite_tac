#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pydantic",
#   "python-dotenv",
#   "pyyaml",
#   "requests",
# ]
# ///

"""
ADW Test Iso - AI Developer Workflow for agentic testing in isolated worktrees

Usage:
  uv run adw_test_iso.py <issue-number> <adw-id> [--skip-e2e]

Workflow:
1. Load state and validate worktree exists
2. Run application test suite in worktree
3. Report results to issue
4. Create commit with test results in worktree
5. Push and update PR

This workflow REQUIRES that adw_plan_iso.py or adw_patch_iso.py has been run first
to create the worktree. It cannot create worktrees itself.
"""

import json
import subprocess
import sys
import os
import logging
from typing import Tuple, Optional, List
from dotenv import load_dotenv
from adw_modules.data_types import (
    AgentTemplateRequest,
    GitHubIssue,
    AgentPromptResponse,
    TestResult,
    E2ETestResult,
    IssueClassSlashCommand,
)
from adw_modules.agent import execute_template
from adw_modules.github import (
    extract_repo_path,
    fetch_issue,
    get_repo_url,
)
from adw_modules.utils import make_adw_id, setup_logger, parse_json, check_env_vars
from adw_modules.state import ADWState
from adw_modules.git_ops import commit_changes, finalize_git_operations
from adw_modules.workflow_ops import (
    format_issue_message,
    create_commit,
    ensure_adw_id,
    classify_issue,
)
from adw_modules.worktree_ops import validate_worktree
from adw_modules.event_manager import event_manager


def emit_event_safe(event_type: str, data: dict, context: dict, logger):
    """Emit event with error handling to prevent workflow crashes.

    This wrapper ensures that missing or invalid events don't crash the workflow.
    Pattern copied from adw_chore_implement.py for consistency.
    """
    try:
        event_manager.emit(event_type, data, context)
    except Exception as e:
        # Log warning but don't crash workflow
        logger.warning(f"Failed to emit event {event_type}: {e}")


# Agent name constants
AGENT_TESTER = "test_runner"
AGENT_E2E_TESTER = "e2e_test_runner"
AGENT_BRANCH_GENERATOR = "branch_generator"

# Maximum number of test retry attempts after resolution
MAX_TEST_RETRY_ATTEMPTS = 4
MAX_E2E_TEST_RETRY_ATTEMPTS = 2  # E2E ui tests




def run_tests(adw_id: str, logger: logging.Logger, working_dir: Optional[str] = None) -> AgentPromptResponse:
    """Run the test suite using the /test command."""
    test_template_request = AgentTemplateRequest(
        agent_name=AGENT_TESTER,
        slash_command="/test",
        args=[],
        adw_id=adw_id,
        working_dir=working_dir,
    )

    logger.debug(
        f"test_template_request: {test_template_request.model_dump_json(indent=2, by_alias=True)}"
    )

    test_response = execute_template(test_template_request)

    logger.debug(
        f"test_response: {test_response.model_dump_json(indent=2, by_alias=True)}"
    )

    return test_response


def parse_test_results(
    output: str, logger: logging.Logger
) -> Tuple[List[TestResult], int, int]:
    """Parse test results JSON and return (results, passed_count, failed_count)."""
    try:
        # Use parse_json to handle markdown-wrapped JSON
        results = parse_json(output, List[TestResult])

        passed_count = sum(1 for test in results if test.passed)
        failed_count = len(results) - passed_count

        return results, passed_count, failed_count
    except Exception as e:
        logger.error(f"Error parsing test results: {e}")
        return [], 0, 0


def parse_e2e_test_results(
    output: str, logger: logging.Logger
) -> Tuple[List[E2ETestResult], int, int]:
    """Parse E2E test results JSON and return (results, passed_count, failed_count)."""
    try:
        # Use parse_json to handle markdown-wrapped JSON
        results = parse_json(output, List[E2ETestResult])

        passed_count = sum(1 for test in results if test.passed)
        failed_count = len(results) - passed_count

        return results, passed_count, failed_count
    except Exception as e:
        logger.error(f"Error parsing E2E test results: {e}")
        return [], 0, 0


def run_e2e_tests(adw_id: str, logger: logging.Logger, working_dir: Optional[str] = None) -> AgentPromptResponse:
    """Run the E2E test suite using the /test_e2e command.

    Note: The test_e2e command will automatically detect and use ports from .ports.env
    in the working directory if it exists.
    """
    test_template_request = AgentTemplateRequest(
        agent_name=AGENT_E2E_TESTER,
        slash_command="/test_e2e",
        args=[],
        adw_id=adw_id,
        working_dir=working_dir,
    )

    logger.debug(
        f"e2e_test_template_request: {test_template_request.model_dump_json(indent=2, by_alias=True)}"
    )

    test_response = execute_template(test_template_request)

    logger.debug(
        f"e2e_test_response: {test_response.model_dump_json(indent=2, by_alias=True)}"
    )

    return test_response


def resolve_failed_tests(
    failed_tests: List[TestResult],
    adw_id: str,
    issue_number: str,
    logger: logging.Logger,
    worktree_path: str,
    iteration: int = 1,
) -> Tuple[int, int]:
    """
    Attempt to resolve failed tests using the resolve_failed_test command.
    Returns (resolved_count, unresolved_count).
    """
    resolved_count = 0
    unresolved_count = 0

    for idx, test in enumerate(failed_tests):
        logger.info(
            f"\n=== Resolving failed test {idx + 1}/{len(failed_tests)}: {test.test_name} ==="
        )

        # Create payload for the resolve command
        test_payload = test.model_dump_json(indent=2)

        # Create agent name with iteration
        agent_name = f"test_resolver_iter{iteration}_{idx}"

        # Create template request with worktree_path
        resolve_request = AgentTemplateRequest(
            agent_name=agent_name,
            slash_command="/resolve_failed_test",
            args=[test_payload],
            adw_id=adw_id,
            working_dir=worktree_path,
        )

        # Emit test resolution start event
        emit_event_safe(
            "execution.test.resolving",
            {"test_name": test.test_name},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Execute resolution
        response = execute_template(resolve_request)

        if response.success:
            resolved_count += 1
            emit_event_safe(
                "result.test.resolved",
                {"test_name": test.test_name},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            logger.info(f"Successfully resolved: {test.test_name}")
        else:
            unresolved_count += 1
            emit_event_safe(
                "error.test.resolution_failed",
                {"test_name": test.test_name},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            logger.error(f"Failed to resolve: {test.test_name}")

    return resolved_count, unresolved_count


def run_tests_with_resolution(
    adw_id: str,
    issue_number: str,
    logger: logging.Logger,
    worktree_path: str,
    max_attempts: int = MAX_TEST_RETRY_ATTEMPTS,
) -> Tuple[List[TestResult], int, int, AgentPromptResponse]:
    """
    Run tests with automatic resolution and retry logic.
    Returns (results, passed_count, failed_count, last_test_response).
    """
    attempt = 0
    results = []
    passed_count = 0
    failed_count = 0
    test_response = None

    while attempt < max_attempts:
        attempt += 1
        logger.info(f"\n=== Test Run Attempt {attempt}/{max_attempts} ===")

        # Emit test run start
        emit_event_safe(
            "execution.test.running",
            {"test_cmd": f"Test attempt {attempt}/{max_attempts}"},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Run tests in worktree
        test_response = run_tests(adw_id, logger, worktree_path)

        # If there was a high level - non-test related error, stop and report it
        if not test_response.success:
            logger.error(f"Error running tests: {test_response.output}")
            emit_event_safe(
                "error.test.failed",
                {"test_cmd": "test suite", "error_output": test_response.output},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            break

        # Parse test results
        results, passed_count, failed_count = parse_test_results(
            test_response.output, logger
        )

        # If no failures or this is the last attempt, we're done
        if failed_count == 0:
            logger.info("All tests passed, stopping retry attempts")
            emit_event_safe(
                "result.test.all_passed",
                {"test_count": len(results)},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            break
        if attempt == max_attempts:
            logger.info(f"Reached maximum retry attempts ({max_attempts}), stopping")
            break

        # If we have failed tests and this isn't the last attempt, try to resolve
        logger.info("\n=== Attempting to resolve failed tests ===")

        # Get list of failed tests
        failed_tests = [test for test in results if not test.passed]

        # Attempt resolution
        resolved, unresolved = resolve_failed_tests(
            failed_tests, adw_id, issue_number, logger, worktree_path, iteration=attempt
        )

        # Report resolution results
        if resolved > 0:
            emit_event_safe(
                "result.test.resolution_progress",
                {"resolved_count": resolved, "total_failures": failed_count},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)

            # Continue to next attempt if we resolved something
            logger.info(f"\n=== Re-running tests after resolving {resolved} tests ===")
        else:
            # No tests were resolved, no point in retrying
            logger.info("No tests were resolved, stopping retry attempts")
            break

    # Log final attempt status
    if attempt == max_attempts and failed_count > 0:
        logger.warning(
            f"Reached maximum retry attempts ({max_attempts}) with {failed_count} failures remaining"
        )
        emit_event_safe(
            "error.test.max_retries_reached",
            {"max_attempts": max_attempts, "failed_count": failed_count},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

    return results, passed_count, failed_count, test_response


def resolve_failed_e2e_tests(
    failed_tests: List[E2ETestResult],
    adw_id: str,
    issue_number: str,
    logger: logging.Logger,
    worktree_path: str,
    iteration: int = 1,
) -> Tuple[int, int]:
    """
    Attempt to resolve failed E2E tests using the resolve_failed_e2e_test command.
    Returns (resolved_count, unresolved_count).
    """
    resolved_count = 0
    unresolved_count = 0

    for idx, test in enumerate(failed_tests):
        logger.info(
            f"\n=== Resolving failed E2E test {idx + 1}/{len(failed_tests)}: {test.test_name} ==="
        )

        # Create payload for the resolve command
        test_payload = test.model_dump_json(indent=2)

        # Create agent name with iteration
        agent_name = f"e2e_test_resolver_iter{iteration}_{idx}"

        # Create template request with worktree_path
        resolve_request = AgentTemplateRequest(
            agent_name=agent_name,
            slash_command="/resolve_failed_e2e_test",
            args=[test_payload],
            adw_id=adw_id,
            working_dir=worktree_path,
        )

        # Emit E2E test resolution start event
        emit_event_safe(
            "execution.test.resolving",
            {"test_name": test.test_name, "test_type": "e2e"},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Execute resolution
        response = execute_template(resolve_request)

        if response.success:
            resolved_count += 1
            emit_event_safe(
                "result.test.resolved",
                {"test_name": test.test_name, "test_type": "e2e"},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            logger.info(f"Successfully resolved E2E test: {test.test_name}")
        else:
            unresolved_count += 1
            emit_event_safe(
                "error.test.resolution_failed",
                {"test_name": test.test_name, "test_type": "e2e"},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            logger.error(f"Failed to resolve E2E test: {test.test_name}")

    return resolved_count, unresolved_count


def run_e2e_tests_with_resolution(
    adw_id: str,
    issue_number: str,
    logger: logging.Logger,
    worktree_path: str,
    max_attempts: int = MAX_E2E_TEST_RETRY_ATTEMPTS,
) -> Tuple[List[E2ETestResult], int, int]:
    """
    Run E2E tests with automatic resolution and retry logic.
    Returns (results, passed_count, failed_count).
    """
    attempt = 0
    results = []
    passed_count = 0
    failed_count = 0

    while attempt < max_attempts:
        attempt += 1
        logger.info(f"\n=== E2E Test Run Attempt {attempt}/{max_attempts} ===")

        # Emit E2E test run start
        emit_event_safe(
            "execution.test.running",
            {"test_cmd": f"E2E test attempt {attempt}/{max_attempts}", "test_type": "e2e"},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Run E2E tests (will auto-detect ports from .ports.env in worktree)
        e2e_response = run_e2e_tests(adw_id, logger, worktree_path)

        if not e2e_response.success:
            logger.error(f"Error running E2E tests: {e2e_response.output}")
            emit_event_safe(
                "error.test.failed",
                {"test_cmd": "E2E test suite", "error_output": e2e_response.output},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            break

        # Parse E2E results
        results, passed_count, failed_count = parse_e2e_test_results(
            e2e_response.output, logger
        )

        if not results:
            logger.warning("No E2E test results to process")
            break

        # If no failures or this is the last attempt, we're done
        if failed_count == 0:
            logger.info("All E2E tests passed, stopping retry attempts")
            emit_event_safe(
                "result.test.all_passed",
                {"test_count": len(results), "test_type": "e2e"},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            break
        if attempt == max_attempts:
            logger.info(
                f"Reached maximum E2E retry attempts ({max_attempts}), stopping"
            )
            break

        # If we have failed tests and this isn't the last attempt, try to resolve
        logger.info("\n=== Attempting to resolve failed E2E tests ===")

        # Get list of failed tests
        failed_tests = [test for test in results if not test.passed]

        # Attempt resolution
        resolved, unresolved = resolve_failed_e2e_tests(
            failed_tests, adw_id, issue_number, logger, worktree_path, iteration=attempt
        )

        # Report resolution results
        if resolved > 0:
            emit_event_safe(
                "result.test.resolution_progress",
                {"resolved_count": resolved, "total_failures": failed_count, "test_type": "e2e"},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)

            # Continue to next attempt if we resolved something
            logger.info(
                f"\n=== Re-running E2E tests after resolving {resolved} tests ==="
            )
        else:
            # No tests were resolved, no point in retrying
            logger.info("No E2E tests were resolved, stopping retry attempts")
            break

    # Log final attempt status
    if attempt == max_attempts and failed_count > 0:
        logger.warning(
            f"Reached maximum E2E retry attempts ({max_attempts}) with {failed_count} failures remaining"
        )
        emit_event_safe(
            "error.test.max_retries_reached",
            {"max_attempts": max_attempts, "failed_count": failed_count, "test_type": "e2e"},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

    return results, passed_count, failed_count


def main():
    """Main entry point."""
    # Load environment variables
    load_dotenv()

    # Check for --skip-e2e flag in args
    skip_e2e = "--skip-e2e" in sys.argv
    # Remove flag from args if present
    if skip_e2e:
        sys.argv.remove("--skip-e2e")

    # Parse command line args
    # INTENTIONAL: adw-id is REQUIRED - we need it to find the worktree
    if len(sys.argv) < 3:
        print("Usage: uv run adw_test_iso.py <issue-number> <adw-id> [--skip-e2e]")
        print("\nError: adw-id is required to locate the worktree")
        print("Run adw_plan_iso.py or adw_patch_iso.py first to create the worktree")
        sys.exit(1)

    issue_number = sys.argv[1]
    adw_id = sys.argv[2]

    # Try to load existing state
    temp_logger = setup_logger(adw_id, "adw_test_iso")
    state = ADWState.load(adw_id, temp_logger)
    if state:
        # Found existing state - use the issue number from state if available
        issue_number = state.get("issue_number", issue_number)

        emit_event_safe(
            "validation.passed",
            {},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)
    else:
        # No existing state found
        logger = setup_logger(adw_id, "adw_test_iso")
        logger.error(f"No state found for ADW ID: {adw_id}")
        logger.error("Run adw_plan_iso.py or adw_patch_iso.py first to create the worktree and state")

        emit_event_safe(
            "validation.state.missing",
            {},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        print(f"\nError: No state found for ADW ID: {adw_id}")
        print("Run adw_plan_iso.py or adw_patch_iso.py first to create the worktree and state")
        sys.exit(1)

    # Track that this ADW workflow has run
    state.append_adw_id("adw_test_iso")

    # Set up logger with ADW ID from command line
    logger = setup_logger(adw_id, "adw_test_iso")
    logger.info(f"ADW Test Iso starting - ID: {adw_id}, Issue: {issue_number}, Skip E2E: {skip_e2e}")

    # Validate environment
    check_env_vars(logger)

    # Emit workflow started event
    emit_event_safe(
        "workflow.started",
        {"workflow_stage": "testing", "task_description": f" (E2E: {'skipped' if skip_e2e else 'enabled'})"},
        {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
    , logger)

    try:
        # Validate worktree exists
        valid, error = validate_worktree(adw_id, state)
        if not valid:
            logger.error(f"Worktree validation failed: {error}")
            logger.error("Run adw_plan_iso.py or adw_patch_iso.py first")

            emit_event_safe(
                "validation.state.invalid",
                {"reason": f"Worktree validation failed: {error}"},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Get worktree path for explicit context
        worktree_path = state.get("worktree_path")
        logger.info(f"Using worktree at: {worktree_path}")

        # Get port information for display
        backend_port = state.get("backend_port", "9100")
        frontend_port = state.get("frontend_port", "9200")

        emit_event_safe(
            "execution.test.started",
            {},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Track results for resolution attempts
        test_results = []
        e2e_results = []

        # Run unit tests (executing in worktree)
        logger.info("Running unit tests in worktree with automatic resolution")

        # Run tests with resolution and retry logic
        results, passed_count, failed_count, test_response = run_tests_with_resolution(
            adw_id, issue_number, logger, worktree_path
        )

        # Track results
        test_results = results

        if not results:
            logger.warning("No test results found in output")
        else:
            logger.info(f"Test results: {passed_count} passed, {failed_count} failed")

        # Run E2E tests if not skipped (executing in worktree)
        e2e_passed = 0
        e2e_failed = 0
        if not skip_e2e:
            logger.info("Running E2E tests in worktree with automatic resolution")

            # Run E2E tests with resolution and retry logic
            e2e_results, e2e_passed, e2e_failed = run_e2e_tests_with_resolution(
                adw_id, issue_number, logger, worktree_path
            )

            if e2e_results:
                logger.info(f"E2E test results: {e2e_passed} passed, {e2e_failed} failed")

        # Check total test results
        total_failures = failed_count + (e2e_failed if not skip_e2e and e2e_results else 0)
        total_passed = passed_count + (e2e_passed if not skip_e2e and e2e_results else 0)

        if total_failures > 0:
            logger.warning(f"Tests completed with {total_failures} failures - continuing to commit results")
            emit_event_safe(
                "result.test.completed_with_failures",
                {"failed_count": total_failures, "passed_count": total_passed},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
        else:
            emit_event_safe(
                "result.test.all_passed",
                {"test_count": total_passed},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)

        # Get repo information
        try:
            github_repo_url = get_repo_url()
            repo_path = extract_repo_path(github_repo_url)
        except ValueError as e:
            logger.error(f"Error getting repository URL: {e}")
            emit_event_safe(
                "workflow.error",
                {"error_message": f"Error getting repository URL: {e}"},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Fetch issue data for commit message generation
        logger.info("Fetching issue data for commit message")
        issue = fetch_issue(issue_number, repo_path)

        # Get issue classification from state or classify if needed
        issue_command = state.get("issue_class")
        if not issue_command:
            logger.info("No issue classification in state, running classify_issue")
            issue_command, error = classify_issue(issue, adw_id, logger)
            if error:
                logger.error(f"Error classifying issue: {error}")
                # Default to feature if classification fails
                issue_command = "/feature"
                logger.warning("Defaulting to /feature after classification error")
            else:
                # Save the classification for future use
                state.update(issue_class=issue_command)
                state.save("adw_test_iso")

        # Create commit message
        logger.info("Creating test commit")

        emit_event_safe(
            "git.commit.creating",
            {},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        commit_msg, error = create_commit(AGENT_TESTER, issue, issue_command, adw_id, logger, worktree_path)

        if error:
            logger.error(f"Error creating commit message: {error}")
            emit_event_safe(
                "workflow.error",
                {"error_message": f"Error creating commit message: {error}"},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Commit the test results (in worktree)
        success, error = commit_changes(commit_msg, cwd=worktree_path)

        if not success:
            logger.error(f"Error committing test results: {error}")
            emit_event_safe(
                "error.git.commit_failed",
                {"error_message": error},
                {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        logger.info(f"Committed test results: {commit_msg}")

        emit_event_safe(
            "git.commit.completed",
            {"commit_message": commit_msg},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Finalize git operations (push and PR)
        # Note: This will work from the worktree context
        finalize_git_operations(state, logger, cwd=worktree_path)

        logger.info("Isolated testing phase completed successfully")

        # Emit workflow completion
        emit_event_safe(
            "workflow.completed",
            {"workflow_stage": "testing"},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Save final state
        state.save("adw_test_iso")

        # Exit with appropriate code based on test results
        if total_failures > 0:
            logger.error(f"Test workflow completed with {total_failures} failures")
            sys.exit(1)
        else:
            logger.info("All tests passed successfully")

    except Exception as e:
        logger.exception(f"Unexpected error in test workflow: {e}")
        emit_event_safe(
            "workflow.error",
            {"error_message": f"Unexpected error: {str(e)}"},
            {"workflow": "adw_test_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)
        raise


if __name__ == "__main__":
    main()
