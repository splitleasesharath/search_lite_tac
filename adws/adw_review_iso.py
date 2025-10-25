#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pydantic",
#   "python-dotenv",
#   "pyyaml",
#   "requests",
#   "boto3>=1.26.0",
# ]
# ///

"""
ADW Review Iso - AI Developer Workflow for agentic review in isolated worktrees

Usage:
  uv run adw_review_iso.py <issue-number> <adw-id> [--skip-resolution]

Workflow:
1. Load state and validate worktree exists
2. Find spec file from worktree
3. Review implementation against specification in worktree
4. Capture screenshots of critical functionality
5. If issues found and --skip-resolution not set:
   - Create patch plans for issues
   - Implement resolutions
6. Post results as commit message
7. Commit review results in worktree
8. Push and update PR

This workflow REQUIRES that adw_plan_iso.py or adw_patch_iso.py has been run first
to create the worktree. It cannot create worktrees itself.
"""

import sys
import os
import logging
import json
from typing import Optional, List
from dotenv import load_dotenv

from adw_modules.state import ADWState
from adw_modules.git_ops import commit_changes, finalize_git_operations
from adw_modules.github import (
    fetch_issue,
    get_repo_url,
    extract_repo_path,
)
from adw_modules.workflow_ops import (
    create_commit,
    implement_plan,
    find_spec_file,
)
from adw_modules.utils import setup_logger, parse_json, check_env_vars
from adw_modules.data_types import (
    AgentTemplateRequest,
    ReviewResult,
    ReviewIssue,
    AgentPromptResponse,
)
from adw_modules.agent import execute_template
from adw_modules.r2_uploader import R2Uploader
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
AGENT_REVIEWER = "reviewer"
AGENT_REVIEW_PATCH_PLANNER = "review_patch_planner"
AGENT_REVIEW_PATCH_IMPLEMENTOR = "review_patch_implementor"

# Maximum number of review retry attempts after resolution
MAX_REVIEW_RETRY_ATTEMPTS = 3




def run_review(
    spec_file: str,
    adw_id: str,
    logger: logging.Logger,
    working_dir: Optional[str] = None,
) -> ReviewResult:
    """Run the review using the /review command."""
    request = AgentTemplateRequest(
        agent_name=AGENT_REVIEWER,
        slash_command="/review",
        args=[adw_id, spec_file, AGENT_REVIEWER],
        adw_id=adw_id,
        working_dir=working_dir,
    )

    logger.debug(f"review_request: {request.model_dump_json(indent=2, by_alias=True)}")

    response = execute_template(request)

    logger.debug(f"review_response: {response.model_dump_json(indent=2, by_alias=True)}")

    if not response.success:
        logger.error(f"Review failed: {response.output}")
        # Return a failed result
        return ReviewResult(
            success=False,
            review_summary=f"Review failed: {response.output}",
            review_issues=[],
            screenshots=[],
            screenshot_urls=[],
        )

    # Parse the review result
    try:
        result = parse_json(response.output, ReviewResult)
        return result
    except Exception as e:
        logger.error(f"Error parsing review result: {e}")
        return ReviewResult(
            success=False,
            review_summary=f"Error parsing review result: {e}",
            review_issues=[],
            screenshots=[],
            screenshot_urls=[],
        )


def create_review_patch_plan(
    issue: ReviewIssue,
    issue_num: int,
    adw_id: str,
    logger: logging.Logger,
    working_dir: Optional[str] = None,
) -> AgentPromptResponse:
    """Create a patch plan for a review issue."""
    # Build patch command with issue details
    patch_args = [
        f"Issue #{issue_num}: {issue.issue_description}",
        f"Resolution: {issue.issue_resolution}",
        f"Severity: {issue.issue_severity}",
    ]

    request = AgentTemplateRequest(
        agent_name=AGENT_REVIEW_PATCH_PLANNER,
        slash_command="/patch",
        args=patch_args,
        adw_id=adw_id,
        working_dir=working_dir,
    )

    return execute_template(request)


def upload_review_screenshots(
    review_result: ReviewResult,
    adw_id: str,
    worktree_path: str,
    issue_number: str,
    logger: logging.Logger
) -> None:
    """Upload screenshots to R2 and update review result with URLs.

    Args:
        review_result: Review result containing screenshot paths
        adw_id: ADW workflow ID
        worktree_path: Path to the worktree
        issue_number: GitHub issue number
        logger: Logger instance

    Note:
        This modifies review_result in-place by setting screenshot_urls
        and updating issue.screenshot_url fields.
    """
    if not review_result.screenshots:
        return

    logger.info(f"Uploading {len(review_result.screenshots)} screenshots")

    emit_event_safe(
        "execution.review.uploading_screenshots",
        {"screenshot_count": len(review_result.screenshots)},
        {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
    , logger)

    uploader = R2Uploader(logger)

    screenshot_urls = []
    for local_path in review_result.screenshots:
        # Convert relative path to absolute path within worktree
        abs_path = os.path.join(worktree_path, local_path)

        if not os.path.exists(abs_path):
            logger.warning(f"Screenshot not found: {abs_path}")
            continue

        # Upload with a nice path
        remote_path = f"adw/{adw_id}/review/{os.path.basename(local_path)}"
        url = uploader.upload_file(abs_path, remote_path)

        if url:
            screenshot_urls.append(url)
            logger.info(f"Uploaded screenshot to: {url}")
        else:
            logger.error(f"Failed to upload screenshot: {local_path}")
            # Fallback to local path if upload fails
            screenshot_urls.append(local_path)

    # Update review result with URLs
    review_result.screenshot_urls = screenshot_urls

    # Update issues with their screenshot URLs
    for issue in review_result.review_issues:
        if issue.screenshot_path:
            # Find corresponding URL
            for i, local_path in enumerate(review_result.screenshots):
                if local_path == issue.screenshot_path and i < len(screenshot_urls):
                    issue.screenshot_url = screenshot_urls[i]
                    break

    emit_event_safe(
        "result.review.screenshots_uploaded",
        {"uploaded_count": len(screenshot_urls)},
        {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
    , logger)


def resolve_blocker_issues(
    blocker_issues: List[ReviewIssue],
    issue_number: str,
    adw_id: str,
    worktree_path: str,
    logger: logging.Logger
) -> None:
    """Resolve blocker issues by creating and implementing patches.

    Args:
        blocker_issues: List of blocker issues to resolve
        issue_number: GitHub issue number
        adw_id: ADW workflow ID
        worktree_path: Path to the worktree
        logger: Logger instance
    """
    logger.info(f"Found {len(blocker_issues)} blocker issues, attempting resolution")

    emit_event_safe(
        "execution.review.resolving_blockers",
        {"blocker_count": len(blocker_issues)},
        {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
    , logger)

    # Create and implement patches for each blocker
    for i, issue in enumerate(blocker_issues, 1):
        logger.info(f"Resolving blocker {i}/{len(blocker_issues)}: {issue.issue_description}")

        # Create patch plan
        plan_response = create_review_patch_plan(issue, i, adw_id, logger, working_dir=worktree_path)

        if not plan_response.success:
            logger.error(f"Failed to create patch plan: {plan_response.output}")
            emit_event_safe(
                "error.review.patch_plan_failed",
                {"blocker_number": i, "issue_description": issue.issue_description},
                {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            continue

        # Extract plan file path
        plan_file = plan_response.output.strip()

        # Implement the patch
        logger.info(f"Implementing patch from plan: {plan_file}")
        impl_response = implement_plan(plan_file, adw_id, logger, working_dir=worktree_path)

        if not impl_response.success:
            logger.error(f"Failed to implement patch: {impl_response.output}")
            emit_event_safe(
                "error.review.patch_implementation_failed",
                {"blocker_number": i, "plan_file": plan_file},
                {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            continue

        logger.info(f"Successfully resolved blocker {i}")
        emit_event_safe(
            "result.review.blocker_resolved",
            {"blocker_number": i, "total_blockers": len(blocker_issues)},
            {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)


def main():
    """Main entry point."""
    # Load environment variables
    load_dotenv()

    # Check for --skip-resolution flag
    skip_resolution = "--skip-resolution" in sys.argv
    if skip_resolution:
        sys.argv.remove("--skip-resolution")

    # Parse command line args
    # INTENTIONAL: adw-id is REQUIRED - we need it to find the worktree
    if len(sys.argv) < 3:
        print("Usage: uv run adw_review_iso.py <issue-number> <adw-id> [--skip-resolution]")
        print("\nError: adw-id is required to locate the worktree")
        print("Run adw_plan_iso.py or adw_patch_iso.py first to create the worktree")
        sys.exit(1)

    issue_number = sys.argv[1]
    adw_id = sys.argv[2]

    # Try to load existing state
    temp_logger = setup_logger(adw_id, "adw_review_iso")
    state = ADWState.load(adw_id, temp_logger)
    if state:
        # Found existing state - use the issue number from state if available
        issue_number = state.get("issue_number", issue_number)

        emit_event_safe(
            "validation.passed",
            {},
            {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)
    else:
        # No existing state found
        logger = setup_logger(adw_id, "adw_review_iso")
        logger.error(f"No state found for ADW ID: {adw_id}")
        logger.error("Run adw_plan_iso.py or adw_patch_iso.py first to create the worktree and state")

        emit_event_safe(
            "validation.state.missing",
            {},
            {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        print(f"\nError: No state found for ADW ID: {adw_id}")
        print("Run adw_plan_iso.py or adw_patch_iso.py first to create the worktree and state")
        sys.exit(1)

    # Track that this ADW workflow has run
    state.append_adw_id("adw_review_iso")

    # Set up logger with ADW ID from command line
    logger = setup_logger(adw_id, "adw_review_iso")
    logger.info(f"ADW Review Iso starting - ID: {adw_id}, Issue: {issue_number}, Skip Resolution: {skip_resolution}")

    # Validate environment
    check_env_vars(logger)

    # Emit workflow started event
    emit_event_safe(
        "workflow.started",
        {"workflow_stage": "review", "task_description": f" (Resolution: {'disabled' if skip_resolution else 'enabled'})"},
        {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
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
                {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Get worktree path for explicit context
        worktree_path = state.get("worktree_path")
        logger.info(f"Using worktree at: {worktree_path}")

        # Get port information for display
        backend_port = state.get("backend_port", "9100")
        frontend_port = state.get("frontend_port", "9200")

        # Find spec file from current branch (in worktree)
        logger.info("Looking for spec file in worktree")
        spec_file = find_spec_file(state, logger)

        if not spec_file:
            error_msg = "Could not find spec file for review"
            logger.error(error_msg)

            emit_event_safe(
                "error.review.spec_not_found",
                {},
                {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        logger.info(f"Found spec file: {spec_file}")

        emit_event_safe(
            "navigation.spec_file.found",
            {"spec_file": spec_file},
            {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Run review with retry logic
        review_attempt = 0
        review_result = None

        while review_attempt < MAX_REVIEW_RETRY_ATTEMPTS:
            review_attempt += 1

            # Run the review (executing in worktree)
            logger.info(f"Running review (attempt {review_attempt}/{MAX_REVIEW_RETRY_ATTEMPTS})")

            emit_event_safe(
                "execution.review.started",
                {"attempt": review_attempt, "max_attempts": MAX_REVIEW_RETRY_ATTEMPTS},
                {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)

            review_result = run_review(spec_file, adw_id, logger, working_dir=worktree_path)

            # Check if we have blocker issues
            blocker_issues = [
                issue for issue in review_result.review_issues
                if issue.issue_severity == "blocker"
            ]

            # Emit review results
            if review_result.success and not blocker_issues:
                emit_event_safe(
                    "result.review.passed",
                    {"issue_count": len(review_result.review_issues), "screenshot_count": len(review_result.screenshots)},
                    {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
                , logger)
            elif blocker_issues:
                emit_event_safe(
                    "result.review.blockers_found",
                    {"blocker_count": len(blocker_issues), "attempt": review_attempt},
                    {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
                , logger)

            # If no blockers or skip resolution, we're done
            if not blocker_issues or skip_resolution:
                break

            # We have blockers and need to resolve them
            resolve_blocker_issues(blocker_issues, issue_number, adw_id, worktree_path, logger)

            # If this was the last attempt, break regardless
            if review_attempt >= MAX_REVIEW_RETRY_ATTEMPTS - 1:
                break

            # Otherwise, we'll retry the review
            logger.info("Retrying review after resolving blockers")

        # Post review results
        if review_result:
            # Upload screenshots to R2 and update URLs
            upload_review_screenshots(review_result, adw_id, worktree_path, issue_number, logger)

        # Get repo information
        try:
            github_repo_url = get_repo_url()
            repo_path = extract_repo_path(github_repo_url)
        except ValueError as e:
            logger.error(f"Error getting repository URL: {e}")
            emit_event_safe(
                "workflow.error",
                {"error_message": f"Error getting repository URL: {e}"},
                {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Fetch issue data for commit message generation
        logger.info("Fetching issue data for commit message")
        issue = fetch_issue(issue_number, repo_path)

        # Get issue classification from state
        issue_command = state.get("issue_class", "/feature")

        # Create commit message
        logger.info("Creating review commit")

        emit_event_safe(
            "git.commit.creating",
            {},
            {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        commit_msg, error = create_commit(AGENT_REVIEWER, issue, issue_command, adw_id, logger, worktree_path)

        if error:
            logger.error(f"Error creating commit message: {error}")
            emit_event_safe(
                "workflow.error",
                {"error_message": f"Error creating commit message: {error}"},
                {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Commit the review results (in worktree)
        success, error = commit_changes(commit_msg, cwd=worktree_path)

        if not success:
            logger.error(f"Error committing review: {error}")
            emit_event_safe(
                "error.git.commit_failed",
                {"error_message": error},
                {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        logger.info(f"Committed review: {commit_msg}")

        emit_event_safe(
            "git.commit.completed",
            {"commit_message": commit_msg},
            {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Finalize git operations (push and PR)
        # Note: This will work from the worktree context
        finalize_git_operations(state, logger, cwd=worktree_path)

        logger.info("Isolated review phase completed successfully")

        # Emit workflow completion
        emit_event_safe(
            "workflow.completed",
            {"workflow_stage": "review"},
            {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Save final state
        state.save("adw_review_iso")

    except Exception as e:
        logger.exception(f"Unexpected error in review workflow: {e}")
        emit_event_safe(
            "workflow.error",
            {"error_message": f"Unexpected error: {str(e)}"},
            {"workflow": "adw_review_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)
        raise


if __name__ == "__main__":
    main()
