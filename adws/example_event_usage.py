#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pyyaml", "requests", "python-dotenv"]
# ///

"""Example demonstrating event manager usage in ADW workflows.

This script shows how to integrate the event-driven notification system
into ADW workflows. It demonstrates:
- Importing the event manager
- Emitting events with proper context
- Different event types (lifecycle, execution, result, error, git)
- Graceful error handling
"""

import sys
import logging
from adw_modules.event_manager import event_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def example_workflow_started():
    """Example: Emit workflow.started event."""
    print("\n=== Example 1: Workflow Started ===")

    event_manager.emit(
        event_type="workflow.started",
        data={"workflow_stage": "planning"},
        context={
            "workflow": "adw_plan_iso",
            "adw_id": "adw-12345678",
            "issue_number": "123"
        }
    )

    print("✅ Emitted workflow.started event")
    print("   - Goes to: GitHub + Slack")
    print("   - Message: ✅ Starting isolated planning phase")


def example_build_command():
    """Example: Emit execution.build.command event."""
    print("\n=== Example 2: Build Command ===")

    event_manager.emit(
        event_type="execution.build.command",
        data={"build_cmd": "npm run build"},
        context={
            "workflow": "adw_build_iso",
            "adw_id": "adw-12345678",
            "issue_number": "123"
        }
    )

    print("✅ Emitted execution.build.command event")
    print("   - Goes to: GitHub only (too noisy for Slack)")
    print("   - Message: 🔨 Running build command: npm run build")


def example_test_passed():
    """Example: Emit result.test.passed event."""
    print("\n=== Example 3: Test Passed ===")

    event_manager.emit(
        event_type="result.test.passed",
        data={"test_cmd": "npm test"},
        context={
            "workflow": "adw_test_iso",
            "adw_id": "adw-12345678",
            "issue_number": "123"
        }
    )

    print("✅ Emitted result.test.passed event")
    print("   - Goes to: GitHub + Slack")
    print("   - Message: ✅ Test passed: npm test")


def example_build_error():
    """Example: Emit error.build.failed event."""
    print("\n=== Example 4: Build Error ===")

    event_manager.emit(
        event_type="error.build.failed",
        data={"stderr": "Error: Module 'react' not found\n  at require (internal/modules/cjs/loader.js:883:19)"},
        context={
            "workflow": "adw_build_iso",
            "adw_id": "adw-12345678",
            "issue_number": "123"
        }
    )

    print("✅ Emitted error.build.failed event")
    print("   - Goes to: GitHub + Slack (high priority)")
    print("   - Message: ❌ Build failed with stderr output")


def example_pr_created():
    """Example: Emit git.pr.created event."""
    print("\n=== Example 5: PR Created ===")

    event_manager.emit(
        event_type="git.pr.created",
        data={
            "pr_url": "https://github.com/user/repo/pull/456",
            "pr_number": "456",
            "branch_name": "chore-12345678-add-feature"
        },
        context={
            "workflow": "adw_plan_iso",
            "adw_id": "adw-12345678",
            "issue_number": "123"
        }
    )

    print("✅ Emitted git.pr.created event")
    print("   - Goes to: GitHub + Slack (high priority)")
    print("   - Message: ✅ Pull request created: https://github.com/user/repo/pull/456")


def example_workflow_completed():
    """Example: Emit workflow.completed event."""
    print("\n=== Example 6: Workflow Completed ===")

    event_manager.emit(
        event_type="workflow.completed",
        data={"workflow_stage": "planning"},
        context={
            "workflow": "adw_plan_iso",
            "adw_id": "adw-12345678",
            "issue_number": "123"
        }
    )

    print("✅ Emitted workflow.completed event")
    print("   - Goes to: GitHub + Slack")
    print("   - Message: ✅ planning phase complete")


def example_navigation_next():
    """Example: Emit navigation.next.suggested event."""
    print("\n=== Example 7: Navigation Next ===")

    event_manager.emit(
        event_type="navigation.next.suggested",
        data={
            "next_workflow": "adw_build_iso.py",
            "issue_number": "123",
            "adw_id": "adw-12345678"
        },
        context={
            "workflow": "adw_plan_iso",
            "adw_id": "adw-12345678",
            "issue_number": "123"
        }
    )

    print("✅ Emitted navigation.next.suggested event")
    print("   - Goes to: GitHub + Slack")
    print("   - Message: ✨ Next: Run adw_build_iso.py 123 adw-12345678")


def example_without_issue_number():
    """Example: Event without issue_number (skipped by handlers)."""
    print("\n=== Example 8: Event Without Issue Number ===")

    event_manager.emit(
        event_type="workflow.started",
        data={"workflow_stage": "planning"},
        context={
            "workflow": "adw_plan_iso",
            "adw_id": "adw-12345678"
            # No issue_number - handlers will skip this
        }
    )

    print("⏭️  Emitted event without issue_number")
    print("   - Handlers skip this event (no issue to comment on)")


def main():
    """Run all examples."""
    print("="*60)
    print("Event Manager Integration Examples")
    print("="*60)
    print("\nNote: These examples will only post to GitHub/Slack if:")
    print("  - You have a valid issue_number in context")
    print("  - GitHub is authenticated (gh CLI)")
    print("  - Slack webhook is configured in .env (for Slack events)")
    print()

    try:
        example_workflow_started()
        example_build_command()
        example_test_passed()
        example_build_error()
        example_pr_created()
        example_workflow_completed()
        example_navigation_next()
        example_without_issue_number()

        print("\n" + "="*60)
        print("✅ All examples completed successfully!")
        print("="*60)

    except Exception as e:
        logger.error(f"Example failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
