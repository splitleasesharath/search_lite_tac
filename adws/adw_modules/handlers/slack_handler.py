"""Slack webhook notification handler.

This handler processes events and posts them to Slack channels via webhooks.
"""

import logging
import time
from typing import Dict, Any, Optional
from .base_handler import EventHandler


class SlackNotificationHandler(EventHandler):
    """Handler that posts events to Slack channel.

    This handler uses the Slack webhook integration to post formatted event
    messages to a Slack channel. It only processes events that:
    - Have 'slack' in the platforms list
    - Have an issue_number in the context
    - Slack is configured (SLACK_WEBHOOK_URL in .env)

    The handler implements graceful degradation - Slack failures are logged
    but don't raise exceptions, preventing them from blocking workflows.
    """

    def __init__(self, logger: Optional[logging.Logger] = None):
        """Initialize Slack notification handler.

        Args:
            logger: Optional logger instance
        """
        super().__init__(logger)

        # Import Slack functions lazily to avoid circular imports
        try:
            from adw_modules.slack import post_to_slack, SlackConfig, format_slack_message
            from adw_modules.github import get_repo_url

            self.post_to_slack = post_to_slack
            self.format_slack_message = format_slack_message
            self.get_repo_url = get_repo_url
            self.config = SlackConfig()
        except ImportError as e:
            self.logger.error(f"Failed to import Slack functions: {e}")
            raise

    def should_handle(self, event: Dict[str, Any]) -> bool:
        """Check if event should be posted to Slack.

        Rules:
        - Slack must be enabled (webhook configured in .env)
        - Must have issue_number in context
        - Must have 'slack' in platforms list

        Args:
            event: Event object with platforms, context, etc.

        Returns:
            True if event should be posted to Slack, False otherwise
        """
        # Check if Slack enabled
        if not self.config.is_enabled():
            return False

        # Check if issue number present
        issue_number = event.get('context', {}).get('issue_number')
        if not issue_number:
            return False

        # Check if slack is in platforms
        platforms = event.get('platforms', [])
        if 'slack' not in platforms:
            return False

        return True

    def handle(self, event: Dict[str, Any]) -> None:
        """Post event to Slack channel.

        Extracts event context and message, formats it with ADW prefix,
        and posts to Slack using post_to_slack().

        This method implements graceful degradation - exceptions are logged
        but not re-raised, preventing Slack failures from blocking workflows.

        Args:
            event: Event object to process
        """
        start_time = time.time()

        try:
            # Extract context
            issue_number = event['context']['issue_number']
            adw_id = event['context'].get('adw_id')
            agent_name = event['context']['agent_name']

            # Get rendered message
            rendered_message = event['message']['rendered']

            # Build comment (with ADW prefix for consistency with GitHub)
            if adw_id:
                comment = f"{adw_id}_{agent_name}: {rendered_message}"
            else:
                comment = f"{agent_name}: {rendered_message}"

            # Get repo URL for linking
            try:
                repo_url = self.get_repo_url().replace(".git", "")
            except Exception as e:
                self.logger.warning(f"Failed to get repo URL: {e}")
                repo_url = None

            # Post to Slack
            self.post_to_slack(issue_number, comment, repo_url)

            duration_ms = int((time.time() - start_time) * 1000)
            self.logger.info(f"✅ slack: {duration_ms}ms | issue #{issue_number} | {event['event_type']}")

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            # Log as warning, not error - Slack failures shouldn't block workflow
            self.logger.warning(f"⚠️ slack: {e} ({duration_ms}ms) | event: {event['event_type']}")
            # Don't re-raise - Slack failures shouldn't block workflow
