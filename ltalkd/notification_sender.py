"""Desktop notification sender using notify-send."""

from __future__ import annotations

import logging
import subprocess
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class NotificationSender:
    """Sends desktop notifications via notify-send (Freedesktop spec)."""

    def __init__(self) -> None:
        self._notification_id: int = 0
        self._reply_callback: Optional[Callable] = None
        logger.info("NotificationSender initialized (notify-send)")

    def set_reply_callback(self, callback: Callable) -> None:
        """Set callback for notification replies."""
        self._reply_callback = callback

    def send_message_notification(
        self,
        sender_name: str,
        message: str,
        chat_id: str,
        avatar_data: Optional[bytes] = None,
    ) -> int:
        """Send a message notification."""
        self._notification_id += 1
        try:
            subprocess.Popen([
                "notify-send",
                "--app-name=LTalk",
                "--icon=ltalk",
                "--category=im.received",
                f"--urgency=normal",
                f"--expire-time=5000",
                sender_name,
                message,
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            logger.info("Notification sent: %s -> %s", sender_name, message[:50])
            return self._notification_id
        except FileNotFoundError:
            logger.debug("notify-send not found, skipping notification")
            return 0
        except Exception as e:
            logger.error("Failed to send notification: %s", e)
            return 0

    def send_call_notification(
        self,
        caller_name: str,
        call_type: str,
        call_id: str,
    ) -> int:
        """Send an incoming call notification (critical priority)."""
        self._notification_id += 1
        try:
            subprocess.Popen([
                "notify-send",
                "--app-name=LTalk",
                "--icon=ltalk",
                "--category=call.incoming",
                "--urgency=critical",
                "--expire-time=0",
                f"Incoming {call_type} call",
                f"{caller_name} is calling",
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return self._notification_id
        except FileNotFoundError:
            return 0
        except Exception as e:
            logger.error("Failed to send call notification: %s", e)
            return 0

    def close_notification(self, notification_id: int) -> None:
        """Close a specific notification (no-op with notify-send)."""
        pass

    def close_all(self) -> None:
        """Close all notifications (no-op with notify-send)."""
        pass
