"""Central event management for ADW notification system.

This module provides the EventManager class which handles:
- Loading event taxonomy from YAML configuration
- Validating event schema
- Enriching events with context
- Routing events to webhook handlers in parallel

The EventManager uses a singleton pattern to ensure consistent event handling
across all workflows.
"""

import os
import yaml
import logging
import sys
import io
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path


# Try to import handlers, but don't fail if they're not available yet
try:
    from .handlers.base_handler import EventHandler
except ImportError:
    EventHandler = None


class EventManager:
    """Centralized event management for ADW webhook notification system.

    The EventManager is the core of the notification system. It:
    1. Loads event definitions from event_taxonomy.yaml
    2. Validates events against the taxonomy
    3. Enriches events with context (timestamp, agent_name, etc.)
    4. Routes events to registered handlers in parallel

    Example usage:
        from adw_modules.event_manager import event_manager

        event_manager.emit(
            event_type="workflow.started",
            data={"workflow_stage": "planning"},
            context={
                "workflow": "adw_plan_iso",
                "adw_id": "adw-12345678",
                "issue_number": "123"
            }
        )
    """

    def __init__(
        self,
        taxonomy_file: Optional[str] = None,
        logger: Optional[logging.Logger] = None
    ):
        """Initialize event manager.

        Args:
            taxonomy_file: Path to event taxonomy YAML. If None, uses default
                          location: adws/adw_config/event_taxonomy.yaml
            logger: Optional logger instance
        """
        self.logger = logger or logging.getLogger(__name__)

        # Ensure logger has at least a basic handler for visibility
        if not self.logger.handlers:
            # Use UTF-8 encoding for Windows compatibility with emojis
            handler = logging.StreamHandler(sys.stdout)
            # Set encoding to UTF-8 if possible (Python 3.7+)
            if hasattr(sys.stdout, 'reconfigure'):
                try:
                    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
                except Exception:
                    pass  # Ignore if reconfigure fails
            handler.setFormatter(logging.Formatter('[EventManager] %(message)s'))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

        # Load taxonomy
        if taxonomy_file is None:
            # Default to adw_config/event_taxonomy.yaml relative to this file
            # Current file: adws/adw_modules/event_manager.py
            # Target: adws/adw_config/event_taxonomy.yaml
            current_file = Path(__file__)
            adws_dir = current_file.parent.parent  # Go up to adws/
            taxonomy_file = adws_dir / "adw_config" / "event_taxonomy.yaml"

        self.taxonomy = self._load_taxonomy(str(taxonomy_file))
        self.handlers: List[EventHandler] = []

        event_count = len(self.taxonomy.get('events', {}))
        self.logger.info(f"EventManager initialized with {event_count} event types")

    def _load_taxonomy(self, file_path: str) -> Dict:
        """Load event taxonomy from YAML configuration.

        Args:
            file_path: Path to event taxonomy YAML file

        Returns:
            Dictionary containing events and platform_routing configuration

        Raises:
            Exception: If taxonomy file cannot be loaded
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                taxonomy = yaml.safe_load(f)
                self.logger.info(f"Loaded event taxonomy from {file_path}")
                return taxonomy
        except FileNotFoundError:
            self.logger.warning(f"Taxonomy file not found: {file_path}, using empty taxonomy")
            return {"events": {}, "platform_routing": {}}
        except Exception as e:
            self.logger.error(f"Failed to load taxonomy: {e}")
            raise

    def register_handler(self, handler: EventHandler) -> None:
        """Register an event handler.

        Handlers are called in the order they are registered. All handlers
        run in parallel when an event is emitted.

        Args:
            handler: EventHandler instance to register
        """
        self.handlers.append(handler)
        self.logger.info(f"Registered handler: {handler.get_platform_name()}")

    def emit(
        self,
        event_type: str,
        data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Emit an event to all registered handlers.

        This is the main entry point for emitting events from workflows.
        The event will be:
        1. Validated against the event taxonomy
        2. Enriched with context (timestamp, agent_name, etc.)
        3. Routed to all handlers that should handle it (in parallel)

        Args:
            event_type: Event type from taxonomy (e.g., "workflow.started")
            data: Event-specific data for template interpolation
                  (e.g., {"workflow_stage": "planning"})
            context: Additional context (adw_id, issue_number, workflow, etc.)

        Raises:
            ValueError: If event type is unknown

        Example:
            event_manager.emit(
                "workflow.started",
                {"workflow_stage": "planning"},
                {"adw_id": "adw-12345678", "issue_number": "123", "workflow": "adw_plan_iso"}
            )
        """
        # Load event definition
        event_def = self.taxonomy.get('events', {}).get(event_type)
        if not event_def:
            self.logger.warning(f"Unknown event type: {event_type}, skipping event emission")
            return  # Gracefully skip unknown events instead of crashing

        # Build event object
        event = self._build_event(event_type, event_def, data, context)

        # Validate event
        self._validate_event(event)

        # Route to handlers in parallel
        import concurrent.futures

        # Filter handlers that should handle this event
        applicable_handlers = [h for h in self.handlers if h.should_handle(event)]

        # Early return if no handlers
        if not applicable_handlers:
            self.logger.debug(f"No handlers for event: {event_type}")
            return

        with concurrent.futures.ThreadPoolExecutor(max_workers=len(applicable_handlers)) as executor:
            futures = []

            for handler in applicable_handlers:
                future = executor.submit(self._safe_handle, handler, event)
                futures.append((handler, future))

            # Wait for all handlers to complete
            for handler, future in futures:
                try:
                    future.result(timeout=10)  # 10 second timeout per handler
                except concurrent.futures.TimeoutError:
                    self.logger.error(f"Handler timeout: {handler.get_platform_name()}")
                except Exception as e:
                    self.logger.error(f"Handler error ({handler.get_platform_name()}): {e}")

    def _safe_handle(self, handler: EventHandler, event: Dict[str, Any]) -> None:
        """Safely handle event with error catching.

        This wrapper ensures that handler failures don't prevent other handlers
        from processing the event.

        Args:
            handler: EventHandler instance
            event: Event object to process
        """
        try:
            handler.handle(event)
        except Exception as e:
            self.logger.error(f"Handler {handler.get_platform_name()} failed: {e}")
            # Don't re-raise - we want other handlers to continue

    def _build_event(
        self,
        event_type: str,
        event_def: Dict,
        data: Dict[str, Any],
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build complete event object from definition and data.

        Args:
            event_type: Event type string
            event_def: Event definition from taxonomy
            data: Event-specific data for template interpolation
            context: Additional context

        Returns:
            Complete event object ready for handlers
        """
        # Apply message template
        message_template = event_def['message']['template']
        try:
            rendered_message = message_template.format(**data)
        except KeyError as e:
            self.logger.warning(f"Missing template variable {e} for event {event_type}, using raw template")
            rendered_message = message_template

        # Build context
        ctx = context or {}

        # Build event
        event = {
            'event_type': event_type,
            'category': event_def['category'],
            'severity': event_def['severity'],
            'message': {
                'template': message_template,
                'rendered': rendered_message,
                'emoji': event_def['message']['emoji'],
                'format': event_def['message'].get('format', 'plain')
            },
            'context': {
                'workflow': ctx.get('workflow'),
                'adw_id': ctx.get('adw_id'),
                'issue_number': ctx.get('issue_number'),
                'agent_name': event_def.get('agent', 'ops'),
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'stage': ctx.get('stage')
            },
            'data': data,
            'actions': event_def.get('actions', []),
            'blocking': event_def.get('blocking', False),
            'universal': event_def.get('universal', False),
            'platforms': event_def.get('platforms', ['github'])  # Default to GitHub only
        }

        return event

    def _validate_event(self, event: Dict[str, Any]) -> None:
        """Validate event against schema.

        Args:
            event: Event object to validate

        Raises:
            ValueError: If event is missing required fields
        """
        required_fields = ['event_type', 'category', 'severity', 'message', 'context']
        for field in required_fields:
            if field not in event:
                raise ValueError(f"Event missing required field: {field}")


# =============================================================================
# Singleton Instance
# =============================================================================

# Global event manager instance
_event_manager: Optional[EventManager] = None


def get_event_manager() -> EventManager:
    """Get or create singleton event manager.

    This function ensures that only one EventManager instance exists across
    the entire application. The first call creates the instance and registers
    default handlers. Subsequent calls return the same instance.

    Returns:
        EventManager singleton instance
    """
    global _event_manager
    if _event_manager is None:
        _event_manager = EventManager()

        # Auto-register default handlers
        _register_default_handlers(_event_manager)

    return _event_manager


def _register_default_handlers(manager: EventManager) -> None:
    """Register default event handlers.

    Attempts to register GitHub and Slack handlers. If import fails,
    logs a warning but doesn't crash.

    Args:
        manager: EventManager instance to register handlers with
    """
    try:
        from .handlers.github_handler import GitHubCommentHandler
        from .handlers.slack_handler import SlackNotificationHandler

        manager.register_handler(GitHubCommentHandler())
        manager.register_handler(SlackNotificationHandler())
        manager.logger.info(f"Registered {len(manager.handlers)} handlers successfully")
    except ImportError as e:
        manager.logger.warning(f"Failed to register some handlers: {e}")
    except Exception as e:
        manager.logger.error(f"Unexpected error registering handlers: {e}")


# Singleton instance - import this in workflows
event_manager = get_event_manager()
