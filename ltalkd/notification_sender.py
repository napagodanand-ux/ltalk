"""D-Bus notification sender with inline reply support."""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class NotificationSender:
    """Sends desktop notifications via DBus (Freedesktop Notifications spec)."""

    def __init__(self) -> None:
        self._dbus_interface: Any = None
        self._notification_id: int = 0
        self._reply_callback: Optional[Callable] = None
        self._init_dbus()

    def _init_dbus(self) -> None:
        """Initialize DBus connection."""
        try:
            from dasbus.connection import SessionMessageBus

            bus = SessionMessageBus()
            self._dbus_interface = bus.get_proxy(
                "org.freedesktop.Notifications",
                "/org/freedesktop/Notifications",
                "org.freedesktop.Notifications",
            )
            # Connect to action invocations
            self._dbus_interface.connect_signal(
                "ActionInvoked", self._on_action_invoked
            )
            logger.info("DBus notifications initialized")
        except (ImportError, OSError) as e:
            logger.warning("DBus not available: %s", e)
            self._dbus_interface = None

    def set_reply_callback(self, callback: Callable) -> None:
        """Set callback for notification replies."""
        self._reply_callback = callback

    def _on_action_invoked(self, notification_id: int, action_key: str) -> None:
        """Handle notification action invocation."""
        logger.debug("Notification action: id=%d, action=%s", notification_id, action_key)
        if action_key == "reply" and self._reply_callback:
            try:
                self._reply_callback(notification_id)
            except Exception as e:
                logger.error("Reply callback error: %s", e)

    def send_message_notification(
        self,
        sender_name: str,
        message: str,
        chat_id: str,
        avatar_data: Optional[bytes] = None,
    ) -> int:
        """Send a message notification with inline reply capability."""
        if not self._dbus_interface:
            logger.debug("DBus not available, skipping notification")
            return 0

        self._notification_id += 1

        try:
            actions = [
                "reply",
                "Reply",
                "mark-read",
                "Mark Read",
            ]

            hints = {
                "category": "im.received",
                "desktop-entry": "ltalk",
            }

            if avatar_data:
                hints["image-data"] = avatar_data

            result = self._dbus_interface.Notify(
                "LTalk",                    # app_name
                self._notification_id,      # replaces_id
                "ltalk",                    # app_icon
                sender_name,                # summary
                message,                    # body
                actions,                    # actions
                hints,                      # hints
                5000,                       # expire_timeout
            )
            logger.info("Notification sent: %s -> %s", sender_name, message[:50])
            return result
        except (OSError, ValueError) as e:
            logger.error("Failed to send notification: %s", e)
            return 0

    def send_call_notification(
        self,
        caller_name: str,
        call_type: str,
        call_id: str,
    ) -> int:
        """Send an incoming call notification (critical priority)."""
        if not self._dbus_interface:
            return 0

        self._notification_id += 1

        try:
            actions = [
                "accept",
                "Accept",
                "decline",
                "Decline",
            ]

            hints = {
                "category": "call.incoming",
                "desktop-entry": "ltalk",
                "urgency": 2,  # Critical
            }

            result = self._dbus_interface.Notify(
                "LTalk",
                self._notification_id,
                "ltalk",
                f"Incoming {call_type} call",
                f"{caller_name} is calling",
                actions,
                hints,
                0,  # Persistent until action
            )
            return result
        except (OSError, ValueError) as e:
            logger.error("Failed to send call notification: %s", e)
            return 0

    def close_notification(self, notification_id: int) -> None:
        """Close a specific notification."""
        if not self._dbus_interface:
            return
        try:
            self._dbus_interface.CloseNotification(notification_id)
        except (OSError, ValueError):
            pass

    def close_all(self) -> None:
        """Close all notifications."""
        if not self._dbus_interface:
            return
        try:
            # The spec doesn't have a close-all, but we can close by ID
            for i in range(1, self._notification_id + 1):
                self.close_notification(i)
        except (OSError, ValueError):
            pass
