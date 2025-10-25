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
ADW Build Iso - AI Developer Workflow for agentic building in isolated worktrees

Usage:
  uv run adw_build_iso.py <issue-number> <adw-id>

Workflow:
1. Load state and validate worktree exists
2. Find existing plan (from state)
3. Implement the solution based on plan in worktree
4. Commit implementation in worktree
5. Push and update PR

This workflow REQUIRES that adw_plan_iso.py or adw_patch_iso.py has been run first
to create the worktree. It cannot create worktrees itself.
"""

import sys
import os
import logging
import json
import subprocess
from typing import Optional
from dotenv import load_dotenv

from adw_modules.state import ADWState
from adw_modules.git_ops import commit_changes, finalize_git_operations, get_current_branch
from adw_modules.github import fetch_issue, get_repo_url, extract_repo_path
from adw_modules.workflow_ops import (
    implement_plan,
    create_commit,
    AGENT_IMPLEMENTOR,
)
from adw_modules.utils import setup_logger, check_env_vars
from adw_modules.data_types import GitHubIssue
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





def main():
    """Main entry point."""
    # Load environment variables
    load_dotenv()

    # Parse command line args
    # INTENTIONAL: adw-id is REQUIRED - we need it to find the worktree
    if len(sys.argv) < 3:
        print("Usage: uv run adw_build_iso.py <issue-number> <adw-id>")
        print("\nError: adw-id is required to locate the worktree and plan file")
        print("Run adw_plan_iso.py or adw_patch_iso.py first to create the worktree")
        sys.exit(1)

    issue_number = sys.argv[1]
    adw_id = sys.argv[2]

    # Try to load existing state
    temp_logger = setup_logger(adw_id, "adw_build_iso")
    state = ADWState.load(adw_id, temp_logger)
    if state:
        # Found existing state - use the issue number from state if available
        issue_number = state.get("issue_number", issue_number)

        emit_event_safe(
            "validation.passed",
            {},
            {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)
    else:
        # No existing state found
        logger = setup_logger(adw_id, "adw_build_iso")
        logger.error(f"No state found for ADW ID: {adw_id}")
        logger.error("Run adw_plan_iso.py first to create the worktree and state")

        emit_event_safe(
            "validation.state.missing",
            {},
            {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        print(f"\nError: No state found for ADW ID: {adw_id}")
        print("Run adw_plan_iso.py first to create the worktree and state")
        sys.exit(1)

    # Track that this ADW workflow has run
    state.append_adw_id("adw_build_iso")

    # Set up logger with ADW ID from command line
    logger = setup_logger(adw_id, "adw_build_iso")
    logger.info(f"ADW Build Iso starting - ID: {adw_id}, Issue: {issue_number}")

    # Validate environment
    check_env_vars(logger)

    # Emit workflow started event
    emit_event_safe(
        "workflow.started",
        {"workflow_stage": "implementation", "task_description": ""},
        {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
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
                {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Get worktree path for explicit context
        worktree_path = state.get("worktree_path")
        logger.info(f"Using worktree at: {worktree_path}")

        # Get repo information
        try:
            github_repo_url = get_repo_url()
            repo_path = extract_repo_path(github_repo_url)
        except ValueError as e:
            logger.error(f"Error getting repository URL: {e}")
            emit_event_safe(
                "workflow.error",
                {"error_message": f"Error getting repository URL: {e}"},
                {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Ensure we have required state fields
        if not state.get("branch_name"):
            error_msg = "No branch name in state - run adw_plan_iso.py first"
            logger.error(error_msg)

            emit_event_safe(
                "validation.state.invalid",
                {"reason": error_msg},
                {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        if not state.get("plan_file"):
            error_msg = "No plan file in state - run adw_plan_iso.py first"
            logger.error(error_msg)

            emit_event_safe(
                "validation.state.invalid",
                {"reason": error_msg},
                {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Checkout the branch in the worktree
        branch_name = state.get("branch_name")
        result = subprocess.run(["git", "checkout", branch_name], capture_output=True, text=True, cwd=worktree_path)
        if result.returncode != 0:
            logger.error(f"Failed to checkout branch {branch_name} in worktree: {result.stderr}")

            emit_event_safe(
                "error.git.checkout_failed",
                {"error_message": result.stderr, "branch_name": branch_name},
                {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        logger.info(f"Checked out branch in worktree: {branch_name}")

        # Get the plan file from state
        plan_file = state.get("plan_file")
        logger.info(f"Using plan file: {plan_file}")

        # Get port information for display
        backend_port = state.get("backend_port", "9100")
        frontend_port = state.get("frontend_port", "9200")

        emit_event_safe(
            "execution.build.started",
            {"worktree_path": worktree_path, "plan_file": plan_file},
            {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Implement the plan (executing in worktree)
        logger.info("Implementing solution in worktree")

        implement_response = implement_plan(plan_file, adw_id, logger, working_dir=worktree_path)

        if not implement_response.success:
            logger.error(f"Error implementing solution: {implement_response.output}")

            emit_event_safe(
                "error.build.failed",
                {"stderr": implement_response.output},
                {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        logger.debug(f"Implementation response: {implement_response.output}")

        emit_event_safe(
            "result.build.success",
            {},
            {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Fetch issue data for commit message generation
        logger.info("Fetching issue data for commit message")
        issue = fetch_issue(issue_number, repo_path)

        # Get issue classification from state or classify if needed
        issue_command = state.get("issue_class")
        if not issue_command:
            logger.info("No issue classification in state, running classify_issue")
            from adw_modules.workflow_ops import classify_issue

            issue_command, error = classify_issue(issue, adw_id, logger)
            if error:
                logger.error(f"Error classifying issue: {error}")
                # Default to feature if classification fails
                issue_command = "/feature"
                logger.warning("Defaulting to /feature after classification error")
            else:
                # Save the classification for future use
                state.update(issue_class=issue_command)
                state.save("adw_build_iso")

        # Create commit message
        logger.info("Creating implementation commit")

        emit_event_safe(
            "git.commit.creating",
            {},
            {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        commit_msg, error = create_commit(AGENT_IMPLEMENTOR, issue, issue_command, adw_id, logger, worktree_path)

        if error:
            logger.error(f"Error creating commit message: {error}")

            emit_event_safe(
                "workflow.error",
                {"error_message": f"Error creating commit message: {error}"},
                {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        # Commit the implementation (in worktree)
        success, error = commit_changes(commit_msg, cwd=worktree_path)

        if not success:
            logger.error(f"Error committing implementation: {error}")

            emit_event_safe(
                "error.git.commit_failed",
                {"error_message": error},
                {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
            , logger)
            sys.exit(1)

        logger.info(f"Committed implementation: {commit_msg}")

        emit_event_safe(
            "git.commit.completed",
            {"commit_message": commit_msg},
            {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Finalize git operations (push and PR)
        # Note: This will work from the worktree context
        finalize_git_operations(state, logger, cwd=worktree_path)

        logger.info("Isolated implementation phase completed successfully")

        # Emit workflow completion
        emit_event_safe(
            "workflow.completed",
            {"workflow_stage": "implementation"},
            {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)

        # Save final state
        state.save("adw_build_iso")

    except Exception as e:
        logger.exception(f"Unexpected error in build workflow: {e}")

        emit_event_safe(
            "workflow.error",
            {"error_message": f"Unexpected error: {str(e)}"},
            {"workflow": "adw_build_iso", "adw_id": adw_id, "issue_number": issue_number}
        , logger)
        raise


if __name__ == "__main__":
    main()
