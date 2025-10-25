"""Base handler class for event processing."""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging


class EventHandler(ABC):
    """Abstract base class for event handlers.

    Event handlers process events emitted by the EventManager and deliver
    them to various platforms (GitHub, Slack, etc.).

    Each handler implements two key methods:
    - should_handle(): Determines if this handler should process the event
    - handle(): Processes the event and delivers it to the platform
    """

    def __init__(self, logger: Optional[logging.Logger] = None):
        """Initialize handler with optional logger.

        Args:
            logger: Optional logger instance. If not provided, creates a logger
                   with the handler's class name.
        """
        self.logger = logger or logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def should_handle(self, event: Dict[str, Any]) -> bool:
        """Determine if this handler should process the event.

        This method checks if the event is appropriate for this handler based on:
        - Platform routing (event['platforms'] contains this platform)
        - Required context (e.g., issue_number for GitHub)
        - Handler configuration (e.g., Slack webhook URL configured)

        Args:
            event: Event object with type, context, data, platforms, etc.

        Returns:
            True if handler should process event, False otherwise
        """
        pass

    @abstractmethod
    def handle(self, event: Dict[str, Any]) -> None:
        """Process the event.

        This method delivers the event to the target platform (GitHub, Slack, etc.).
        It should:
        - Extract necessary data from event
        - Format the message appropriately for the platform
        - Send the notification with proper error handling
        - Log success/failure

        Args:
            event: Event object to process

        Raises:
            Exception: If handler fails to process event. The EventManager will
                      catch this exception and log it, allowing other handlers
                      to continue processing.
        """
        pass

    def get_platform_name(self) -> str:
        """Get platform name for logging.

        Extracts platform name from class name by removing 'Handler' suffix
        and converting to lowercase.

        Examples:
            GitHubCommentHandler -> githubcomment
            SlackNotificationHandler -> slacknotification

        Returns:
            Platform name string
        """
        return self.__class__.__name__.replace("Handler", "").lower()
