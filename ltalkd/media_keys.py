"""D-Bus media key handler for Linux desktop integration."""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class MediaKeyHandler:
    """Listens for media key presses via D-Bus portals."""

    def __init__(self) -> None:
        self._portal: Any = None
        self._callbacks: dict[str, Callable] = {}
        self._init_portal()

    def _init_portal(self) -> None:
        """Initialize the MediaKeys portal connection."""
        try:
            from dasbus.connection import SessionMessageBus

            bus = SessionMessageBus()
            self._portal = bus.get_proxy(
                "org.freedesktop.portal.Desktop",
                "/org/freedesktop/portal/desktop",
                "org.freedesktop.portal.MediaKeys",
            )
            logger.info("MediaKeys portal initialized")
        except (ImportError, OSError) as e:
            logger.debug("MediaKeys portal not available: %s", e)
            self._portal = None

    def register(self, key: str, callback: Callable) -> None:
        """Register a callback for a media key."""
        self._callbacks[key] = callback

    def start(self) -> None:
        """Start listening for media key events."""
        if not self._portal:
            return

        try:
            # Connect to the signals
            self._portal_signal = self._portal.connect_signal(
                "MediaPlayerKeyPressed",
                self._on_media_key,
            )
            logger.info("Media key listener started")
        except (OSError, AttributeError) as e:
            logger.warning("Failed to start media key listener: %s", e)

    def stop(self) -> None:
        """Stop listening for media key events."""
        if hasattr(self, "_portal_signal"):
            try:
                self._portal_signal.disconnect()
            except (OSError, AttributeError):
                pass

    def _on_media_key(self, session: Any, key: str) -> None:
        """Handle media key press."""
        if key in self._callbacks:
            try:
                self._callbacks[key]()
            except Exception as e:
                logger.error("Media key callback error: %s", e)


class GlobalHotkeyHandler:
    """Handles global keyboard shortcuts via D-Bus."""

    def __init__(self) -> None:
        self._shortcut_service: Any = None
        self._callbacks: dict[str, Callable] = {}

    def register(self, shortcut: str, callback: Callable) -> None:
        """Register a global shortcut."""
        self._callbacks[shortcut] = callback

    def start(self) -> None:
        """Start listening for global shortcuts."""
        try:
            from dasbus.connection import SessionMessageBus

            bus = SessionMessageBus()
            self._shortcut_service = bus.get_proxy(
                "org.freedesktop.portal.Desktop",
                "/org/freedesktop/portal/desktop",
                "org.freedesktop.portal.GlobalShortcuts",
            )
            logger.info("Global shortcuts portal initialized")
        except (ImportError, OSError) as e:
            logger.debug("Global shortcuts portal not available: %s", e)
            self._shortcut_service = None

    def stop(self) -> None:
        """Stop listening for global shortcuts."""
        if hasattr(self, "_portal_signal"):
            try:
                self._portal_signal.disconnect()
            except Exception:
                pass
        self._shortcut_service = None
