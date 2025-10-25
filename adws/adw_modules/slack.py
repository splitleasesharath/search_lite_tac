#!/usr/bin/env -S uv run
# /// script
# dependencies = ["requests", "python-dotenv"]
# ///

"""Slack notification module for ADW system.

This module provides Slack webhook integration for sending workflow notifications
to Slack channels. It handles:
- Webhook URL configuration from .env
- Rich message formatting with Slack blocks
- Retry logic with exponential backoff
- Graceful degradation (failures don't block workflows)
"""

import os
import requests
import logging
import socket
from typing import Optional, Dict, Any
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv

# Load environment variables from centralized .env file
load_dotenv()

# Slack bot identifier
SLACK_BOT_NAME = "ADW Bot"
SLACK_BOT_ICON = ":robot_face:"

# Get hostname for all messages
HOSTNAME = socket.gethostname()


class SlackConfig:
    """Slack configuration from centralized .env file.

    Reads Slack webhook configuration from .env and provides a simple
    interface to check if Slack is enabled.
    """

    def __init__(self):
        """Initialize Slack configuration from environment variables."""
        self.webhook_url = os.getenv("SLACK_WEBHOOK_URL")
        self.enabled = bool(self.webhook_url)
        self.timeout = int(os.getenv("SLACK_TIMEOUT", "5"))
        self.max_retries = int(os.getenv("SLACK_MAX_RETRIES", "2"))

    def is_enabled(self) -> bool:
        """Check if Slack notifications are enabled.

        Returns:
            True if SLACK_WEBHOOK_URL is configured, False otherwise
        """
        return self.enabled


def get_slack_session() -> requests.Session:
    """Create requests session with retry logic.

    Configures exponential backoff for transient errors (429, 500, 502, 503, 504).

    Returns:
        Configured requests.Session instance
    """
    session = requests.Session()

    # Configure retries for transient errors
    retry_strategy = Retry(
        total=2,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["POST"]
    )

    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)

    return session


def format_slack_message(
    issue_id: str,
    comment: str,
    repo_url: Optional[str] = None
) -> Dict[str, Any]:
    """Format message for Slack as simple text with hostname and issue number.

    Creates a simple text message with:
    - HOSTNAME prefix
    - Issue number
    - Message content
    - No fancy formatting or emojis (except for completed workflows)

    Args:
        issue_id: GitHub issue number
        comment: Comment text (may include ADW prefix like "adw-12345678_ops: message")
        repo_url: Optional repository URL for creating issue links

    Returns:
        Slack webhook payload dict with simple text

    Example:
        >>> format_slack_message("123", "adw-12345678_ops: Build complete", "https://github.com/user/repo")
        {
            "username": "ADW Bot",
            "icon_emoji": ":robot_face:",
            "text": "[DESKTOP-XYZ] Issue #123: adw-12345678_ops: Build complete"
        }
    """
    # Strip bot identifier
    clean_comment = comment.replace("[ADW-AGENTS]", "").strip()

    # Build issue link for reference
    if repo_url:
        issue_link = f"<{repo_url}/issues/{issue_id}|#{issue_id}>"
    else:
        issue_link = f"#{issue_id}"

    # Build simple text message with HOSTNAME and issue number - no emojis
    text = f"[{HOSTNAME}] Issue {issue_link}: {clean_comment}"

    # Build payload with simple text
    payload = {
        "username": SLACK_BOT_NAME,
        "icon_emoji": SLACK_BOT_ICON,
        "text": text
    }

    return payload


def post_to_slack(
    issue_id: str,
    comment: str,
    repo_url: Optional[str] = None
) -> None:
    """Post notification to Slack channel via webhook from .env.

    This function is the main entry point for posting notifications to Slack.
    It handles:
    - Configuration checking (skip if not configured)
    - Message formatting
    - HTTP request with retry logic
    - Error handling with graceful degradation

    Args:
        issue_id: GitHub issue number
        comment: Comment text to post
        repo_url: Optional repository URL for creating issue links

    Raises:
        requests.exceptions.Timeout: If request times out
        requests.exceptions.RequestException: If request fails

    Example:
        post_to_slack("123", "adw-12345678_ops: ✅ Build complete", "https://github.com/user/repo")
    """
    config = SlackConfig()

    if not config.is_enabled():
        logging.debug("Slack webhook not configured in .env")
        return

    # Format message
    payload = format_slack_message(issue_id, comment, repo_url)

    # Create session with retry logic
    session = get_slack_session()

    try:
        response = session.post(
            config.webhook_url,
            json=payload,
            timeout=config.timeout
        )
        response.raise_for_status()
        logging.info(f"Posted Slack notification for issue #{issue_id}")

    except requests.exceptions.Timeout:
        logging.warning(f"Slack timeout for issue #{issue_id}")
        raise
    except requests.exceptions.RequestException as e:
        logging.warning(f"Slack failed for issue #{issue_id}: {e}")
        raise
    finally:
        session.close()
