"""Test GitHub handler."""

import pytest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock, Mock

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from adws.adw_modules.handlers.github_handler import GitHubCommentHandler


@patch('adws.adw_modules.handlers.github_handler.make_issue_comment')
@patch('adws.adw_modules.handlers.github_handler.format_issue_message')
def test_github_handler_posts_event(mock_format, mock_post):
    """Test that GitHub handler posts events."""
    mock_format.return_value = "adw-12345678_ops: Test message"

    handler = GitHubCommentHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['github'],
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            'adw_id': 'adw-12345678',
            'agent_name': 'ops'
        }
    }

    assert handler.should_handle(event) is True
    handler.handle(event)

    # Verify format_issue_message was called
    mock_format.assert_called_once_with('adw-12345678', 'ops', 'Test message')

    # Verify make_issue_comment was called
    mock_post.assert_called_once_with('123', 'adw-12345678_ops: Test message')


def test_github_handler_skips_without_issue_number():
    """Test that handler skips events without issue_number."""
    handler = GitHubCommentHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['github'],
        'message': {'rendered': 'Test message'},
        'context': {
            # Missing issue_number
            'adw_id': 'adw-12345678',
            'agent_name': 'ops'
        }
    }

    assert handler.should_handle(event) is False


def test_github_handler_skips_without_github_platform():
    """Test that handler skips events not targeting github."""
    handler = GitHubCommentHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['slack'],  # Only slack, not github
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            'adw_id': 'adw-12345678',
            'agent_name': 'ops'
        }
    }

    assert handler.should_handle(event) is False


@patch('adws.adw_modules.handlers.github_handler.make_issue_comment')
@patch('adws.adw_modules.handlers.github_handler.format_issue_message')
def test_github_handler_without_adw_id(mock_format, mock_post):
    """Test that handler works without adw_id."""
    handler = GitHubCommentHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['github'],
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            # No adw_id
            'agent_name': 'ops'
        }
    }

    handler.handle(event)

    # Should not call format_issue_message when no adw_id
    mock_format.assert_not_called()

    # Should post with just agent name prefix
    mock_post.assert_called_once_with('123', 'ops: Test message')


@patch('adws.adw_modules.handlers.github_handler.make_issue_comment')
def test_github_handler_error_handling(mock_post):
    """Test that handler raises exception on failure."""
    mock_post.side_effect = Exception("GitHub API error")

    handler = GitHubCommentHandler()

    event = {
        'event_type': 'workflow.started',
        'platforms': ['github'],
        'message': {'rendered': 'Test message'},
        'context': {
            'issue_number': '123',
            'agent_name': 'ops'
        }
    }

    with pytest.raises(Exception, match="GitHub API error"):
        handler.handle(event)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
