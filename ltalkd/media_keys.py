"""Global keyboard shortcut handler for Linux desktop integration."""

from __future__ import annotations

import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


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
