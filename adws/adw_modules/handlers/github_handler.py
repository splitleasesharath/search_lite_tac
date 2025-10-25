"""GitHub issue comment handler.

This handler processes events and posts them as GitHub issue comments using
the gh CLI tool.
"""

import logging
import time
import socket
from typing import Dict, Any, Optional
from .base_handler import EventHandler

# Get hostname for all messages
HOSTNAME = socket.gethostname()


class GitHubCommentHandler(EventHandler):
    """Handler that posts events as GitHub issue comments.

    This handler uses the existing make_issue_comment() function to post
    formatted event messages to GitHub issues. It only processes events that:
    - Have 'github' in the platforms list
    - Have an issue_number in the context

    The handler formats messages with ADW prefixes (adw_id_agent) and
    measures posting latency.
    """

    def __init__(self, logger: Optional[logging.Logger] = None):
        """Initialize GitHub comment handler.

        Args:
            logger: Optional logger instance
        """
        super().__init__(logger)

        # Import GitHub functions lazily to avoid circular imports
        try:
            from adw_modules.github import make_issue_comment
            from adw_modules.workflow_ops import format_issue_message

            self.make_issue_comment = make_issue_comment
            self.format_issue_message = format_issue_message
        except ImportError as e:
            self.logger.error(f"Failed to import GitHub functions: {e}")
            raise

    def should_handle(self, event: Dict[str, Any]) -> bool:
        """Check if event should be posted to GitHub.

        Rules:
        - Must have issue_number in context
        - Must have 'github' in platforms list

        Args:
            event: Event object with platforms, context, etc.

        Returns:
            True if event should be posted to GitHub, False otherwise
        """
        # Check if issue number present
        issue_number = event.get('context', {}).get('issue_number')
        if not issue_number:
            return False

        # Check if github is in platforms
        platforms = event.get('platforms', [])
        if 'github' not in platforms:
            return False

        return True

    def handle(self, event: Dict[str, Any]) -> None:
        """Post event as GitHub issue comment.

        Extracts event context and message, formats it with ADW prefix,
        and posts to GitHub using make_issue_comment().

        Args:
            event: Event object to process

        Raises:
            Exception: If GitHub posting fails
        """
        start_time = time.time()

        try:
            # Extract context
            issue_number = event['context']['issue_number']
            adw_id = event['context'].get('adw_id')
            agent_name = event['context']['agent_name']

            # Get rendered message
            rendered_message = event['message']['rendered']

            # Format with HOSTNAME, ADW prefix, and issue number
            # Note: make_issue_comment will add [ADW-AGENTS] prefix automatically
            if adw_id:
                full_message = f"[{HOSTNAME}] Issue #{issue_number}: {adw_id}_{agent_name}: {rendered_message}"
            else:
                # If no adw_id, just add agent name prefix with hostname
                full_message = f"[{HOSTNAME}] Issue #{issue_number}: {agent_name}: {rendered_message}"

            # Post to GitHub
            self.make_issue_comment(issue_number, full_message)

            duration_ms = int((time.time() - start_time) * 1000)
            self.logger.info(f"✅ github: {duration_ms}ms | issue #{issue_number} | {event['event_type']}")

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            self.logger.error(f"❌ github: {e} ({duration_ms}ms) | event: {event['event_type']}")
            raise
