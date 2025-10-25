"""Test Slack handler."""

import pytest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock, Mock

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from adws.adw_modules.handlers.slack_handler import SlackNotificationHandler


@patch('adws.adw_modules.handlers.slack_handler.post_to_slack')
@patch('adws.adw_modules.handlers.slack_handler.get_repo_url')
@patch.dict('os.environ', {'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/test'})
def test_slack_handler_posts_event(mock_get_repo, mock_post):
    """Test that Slack handler posts events."""
    mock_get_repo.return_value = 'https://github.com/user/repo.git'

    handler = SlackNotificationHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['slack'],
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            'adw_id': 'adw-12345678',
            'agent_name': 'ops'
        }
    }

    assert handler.should_handle(event) is True
    handler.handle(event)

    # Verify post_to_slack was called
    mock_post.assert_called_once_with(
        '123',
        'adw-12345678_ops: Test message',
        'https://github.com/user/repo'
    )


@patch.dict('os.environ', {}, clear=True)
def test_slack_handler_skips_when_not_configured():
    """Test that handler skips events when Slack not configured."""
    handler = SlackNotificationHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['slack'],
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            'adw_id': 'adw-12345678',
            'agent_name': 'ops'
        }
    }

    # Should return False when SLACK_WEBHOOK_URL not set
    assert handler.should_handle(event) is False


@patch.dict('os.environ', {'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/test'})
def test_slack_handler_skips_without_issue_number():
    """Test that handler skips events without issue_number."""
    handler = SlackNotificationHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['slack'],
        'message': {'rendered': 'Test message'},
        'context': {
            # Missing issue_number
            'adw_id': 'adw-12345678',
            'agent_name': 'ops'
        }
    }

    assert handler.should_handle(event) is False


@patch.dict('os.environ', {'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/test'})
def test_slack_handler_skips_without_slack_platform():
    """Test that handler skips events not targeting slack."""
    handler = SlackNotificationHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['github'],  # Only github, not slack
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            'adw_id': 'adw-12345678',
            'agent_name': 'ops'
        }
    }

    assert handler.should_handle(event) is False


@patch('adws.adw_modules.handlers.slack_handler.post_to_slack')
@patch('adws.adw_modules.handlers.slack_handler.get_repo_url')
@patch.dict('os.environ', {'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/test'})
def test_slack_handler_without_adw_id(mock_get_repo, mock_post):
    """Test that handler works without adw_id."""
    mock_get_repo.return_value = 'https://github.com/user/repo.git'

    handler = SlackNotificationHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['slack'],
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            # No adw_id
            'agent_name': 'ops'
        }
    }

    handler.handle(event)

    # Should post with just agent name prefix
    mock_post.assert_called_once_with(
        '123',
        'ops: Test message',
        'https://github.com/user/repo'
    )


@patch('adws.adw_modules.handlers.slack_handler.post_to_slack')
@patch('adws.adw_modules.handlers.slack_handler.get_repo_url')
@patch.dict('os.environ', {'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/test'})
def test_slack_handler_graceful_degradation(mock_get_repo, mock_post):
    """Test that Slack failures don't raise exceptions (graceful degradation)."""
    mock_get_repo.return_value = 'https://github.com/user/repo.git'
    mock_post.side_effect = Exception("Slack API error")

    handler = SlackNotificationHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['slack'],
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            'adw_id': 'adw-12345678',
            'agent_name': 'ops'
        }
    }

    # Should NOT raise exception - graceful degradation
    handler.handle(event)  # Should complete without error


@patch('adws.adw_modules.handlers.slack_handler.post_to_slack')
@patch('adws.adw_modules.handlers.slack_handler.get_repo_url')
@patch.dict('os.environ', {'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/test'})
def test_slack_handler_handles_repo_url_error(mock_get_repo, mock_post):
    """Test that handler handles repo URL errors gracefully."""
    mock_get_repo.side_effect = Exception("Git error")

    handler = SlackNotificationHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['slack'],
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            'adw_id': 'adw-12345678',
            'agent_name': 'ops'
        }
    }

    handler.handle(event)

    # Should still post to Slack, but with None for repo_url
    mock_post.assert_called_once_with(
        '123',
        'adw-12345678_ops: Test message',
        None
    )


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
