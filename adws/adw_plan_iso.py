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
ADW Plan Iso - AI Developer Workflow for agentic planning in isolated worktrees

Usage:
  uv run adw_plan_iso.py <issue-number> [adw-id]

Workflow:
1. Fetch GitHub issue details
2. Check/create worktree for isolated execution
3. Allocate unique ports for services
4. Setup worktree environment
5. Classify issue type (/chore, /bug, /feature)
6. Create feature branch in worktree
7. Generate implementation plan in worktree
8. Commit plan in worktree
9. Push and create/update PR

This workflow creates an isolated git worktree under trees/<adw_id>/ for
parallel execution without interference.
"""

import sys
import os
import logging
import json
from typing import Optional
from dotenv import load_dotenv

from adw_modules.state import ADWState
from adw_modules.git_ops import commit_changes, finalize_git_operations
from adw_modules.github import (
    fetch_issue,
    get_repo_url,
    extract_repo_path,
)
from adw_modules.workflow_ops import (
    classify_issue,
    build_plan,
    generate_branch_name,
    create_commit,
    ensure_adw_id,
    AGENT_PLANNER,
)
from adw_modules.utils import setup_logger, check_env_vars
from adw_modules.data_types import GitHubIssue, IssueClassSlashCommand, AgentTemplateRequest
from adw_modules.agent import execute_template
from adw_modules.worktree_ops import (
    create_worktree,
    validate_worktree,
    get_ports_for_adw,
    is_port_available,
    find_next_available_ports,
    setup_worktree_environment,
)
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


def main():
    """Main entry point."""
    # Force UTF-8 encoding for Windows console to handle emoji characters
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    # Load environment variables
    load_dotenv()

    # Parse command line args
    if len(sys.argv) < 2:
        print("Usage: uv run adw_plan_iso.py <issue-number> [adw-id]")
        sys.exit(1)

    issue_number = sys.argv[1]
    adw_id = sys.argv[2] if len(sys.argv) > 2 else None

    # Ensure ADW ID exists with initialized state
    temp_logger = setup_logger(adw_id, "adw_plan_iso") if adw_id else None
    adw_id = ensure_adw_id(issue_number, adw_id, temp_logger)

    # Load the state that was created/found by ensure_adw_id
    state = ADWState.load(adw_id, temp_logger)

    # Ensure state has the adw_id field
    if not state.get("adw_id"):
        state.update(adw_id=adw_id)

    # Update state with issue_number for event context
    state.update(issue_number=issue_number)

    # Track that this ADW workflow has run
    state.append_adw_id("adw_plan_iso")

    # Set up logger with ADW ID
    logger = setup_logger(adw_id, "adw_plan_iso")
    logger.info(f"ADW Plan Iso starting - ID: {adw_id}, Issue: {issue_number}")

    # Validate environment
    check_env_vars(logger)

    # Get repo information
    try:
        github_repo_url = get_repo_url()
        repo_path = extract_repo_path(github_repo_url)
    except ValueError as e:
        logger.error(f"Error getting repository URL: {e}")
        emit_event_safe(
            "workflow.error",
            {"error_message": f"Error getting repository URL: {e}"},
            {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number},
            logger
        )
        sys.exit(1)

    # Fetch issue details
    issue: GitHubIssue = fetch_issue(issue_number, repo_path)

    logger.debug(f"Fetched issue: {issue.model_dump_json(indent=2, by_alias=True)}")

    # Emit workflow started event
    emit_event_safe(
        "workflow.started",
        {"workflow_stage": "planning", "task_description": f" - {issue.title}"},
        {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}
    , logger)

    try:
        # Check if worktree already exists
        valid, error = validate_worktree(adw_id, state)
        if valid:
            logger.info(f"Using existing worktree for {adw_id}")
            worktree_path = state.get("worktree_path")
            backend_port = state.get("backend_port")
            frontend_port = state.get("frontend_port")
        else:
            # Allocate ports for this instance
            backend_port, frontend_port = get_ports_for_adw(adw_id)

            # Check port availability
            if not (is_port_available(backend_port) and is_port_available(frontend_port)):
                logger.warning(f"Deterministic ports {backend_port}/{frontend_port} are in use, finding alternatives")
                backend_port, frontend_port = find_next_available_ports(adw_id)

            logger.info(f"Allocated ports - Backend: {backend_port}, Frontend: {frontend_port}")
            state.update(backend_port=backend_port, frontend_port=frontend_port)
            state.save("adw_plan_iso")

        # Classify the issue
        emit_event_safe(
            "execution.classification.started",
            {},
            {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        issue_command, error = classify_issue(issue, adw_id, logger)

        if error:
            logger.error(f"Error classifying issue: {error}")
            emit_event_safe("error.classification.failed", {"error_message": error}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)
            sys.exit(1)

        state.update(issue_class=issue_command)
        state.save("adw_plan_iso")
        logger.info(f"Issue classified as: {issue_command}")

        emit_event_safe("result.classification.completed", {"issue_class": issue_command}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)

        # Generate branch name
        emit_event_safe(
            "git.branch.generating",
            {},
            {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        branch_name, error = generate_branch_name(issue, issue_command, adw_id, logger)

        if error:
            logger.error(f"Error generating branch name: {error}")
            emit_event_safe(
                "workflow.error",
                {"error_message": f"Error generating branch name: {error}"},
                {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Don't create branch here - let worktree create it
        # The worktree command will create the branch when we specify -b
        state.update(branch_name=branch_name)
        state.save("adw_plan_iso")
        logger.info(f"Will create branch in worktree: {branch_name}")

        # Create worktree if it doesn't exist
        if not valid:
            logger.info(f"Creating worktree for {adw_id}")

            emit_event_safe("execution.worktree.creating", {"worktree_id": adw_id, "branch_name": branch_name}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)

            worktree_path, error = create_worktree(adw_id, branch_name, logger)

            if error:
                logger.error(f"Error creating worktree: {error}")
                emit_event_safe("error.worktree.creation_failed", {"error_message": error}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)
                sys.exit(1)

            state.update(worktree_path=worktree_path)
            state.save("adw_plan_iso")
            logger.info(f"Created worktree at {worktree_path}")

            # Setup worktree environment (create .ports.env)
            setup_worktree_environment(worktree_path, backend_port, frontend_port, logger)

            # Run install_worktree command to set up the isolated environment
            logger.info("Setting up isolated environment with custom ports")
            install_request = AgentTemplateRequest(
                agent_name="ops",
                slash_command="/install_worktree",
                args=[worktree_path, str(backend_port), str(frontend_port)],
                adw_id=adw_id,
                working_dir=worktree_path,  # Execute in worktree
            )

            install_response = execute_template(install_request)
            if not install_response.success:
                logger.error(f"Error setting up worktree: {install_response.output}")
                emit_event_safe("error.worktree.setup_failed", {"error_message": install_response.output}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)
                sys.exit(1)

            logger.info("Worktree environment setup complete")

        emit_event_safe("result.worktree.ready", {"worktree_path": worktree_path, "backend_port": backend_port, "frontend_port": frontend_port}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)

        # Build the implementation plan (now executing in worktree)
        logger.info("Building implementation plan in worktree")
        emit_event_safe(
            "execution.plan.started",
            {},
            {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        plan_response = build_plan(issue, issue_command, adw_id, logger, working_dir=worktree_path)

        if not plan_response.success:
            logger.error(f"Error building plan: {plan_response.output}")
            emit_event_safe("error.plan.failed", {"error_message": plan_response.output}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)
            sys.exit(1)

        logger.debug(f"Plan response: {plan_response.output}")

        emit_event_safe(
            "result.plan.created",
            {},
            {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Get the plan file path directly from response
        logger.info("Getting plan file path")
        plan_file_path = plan_response.output.strip()

        # Validate the path exists (within worktree)
        if not plan_file_path:
            error = "No plan file path returned from planning agent"
            logger.error(error)
            emit_event_safe("workflow.error", {"error_message": error}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)
            sys.exit(1)

        # Check if file exists in worktree
        worktree_plan_path = os.path.join(worktree_path, plan_file_path)
        if not os.path.exists(worktree_plan_path):
            error = f"Plan file does not exist in worktree: {plan_file_path}"
            logger.error(error)
            emit_event_safe("workflow.error", {"error_message": error}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)
            sys.exit(1)

        state.update(plan_file=plan_file_path)
        state.save("adw_plan_iso")
        logger.info(f"Plan file created: {plan_file_path}")

        emit_event_safe("navigation.plan_file.created", {"plan_file": plan_file_path}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)

        # Create commit message
        logger.info("Creating plan commit")
        commit_msg, error = create_commit(
            AGENT_PLANNER, issue, issue_command, adw_id, logger, worktree_path
        )

        if error:
            logger.error(f"Error creating commit message: {error}")
            emit_event_safe(
                "workflow.error",
                {"error_message": f"Error creating commit message: {error}"},
                {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Commit the plan (in worktree)
        emit_event_safe("git.commit.creating", {"commit_message": commit_msg}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)

        success, error = commit_changes(commit_msg, cwd=worktree_path)

        if not success:
            logger.error(f"Error committing plan: {error}")
            emit_event_safe("error.git.commit_failed", {"error_message": error}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)
            sys.exit(1)

        logger.info(f"Committed plan: {commit_msg}")
        emit_event_safe("git.commit.completed", {"commit_message": commit_msg}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)

        # Finalize git operations (push and PR)
        # Note: This will work from the worktree context
        finalize_git_operations(state, logger, cwd=worktree_path)

        logger.info("Isolated planning phase completed successfully")

        # Emit workflow completion
        emit_event_safe("workflow.completed", {"workflow_stage": "planning"}, {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}, logger)

        # Save final state
        state.save("adw_plan_iso")

    except Exception as e:
        logger.exception(f"Unexpected error in planning workflow: {e}")
        emit_event_safe(
            "workflow.error",
            {"error_message": f"Unexpected error: {str(e)}"},
            {"workflow": "adw_plan_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)
        raise


if __name__ == "__main__":
    main()
