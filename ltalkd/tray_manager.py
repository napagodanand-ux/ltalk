"""System tray manager with unread badge."""

from __future__ import annotations

import logging
import os
import subprocess
import sys
from typing import Any, Optional

logger = logging.getLogger(__name__)


class TrayManager:
    """Manages the system tray icon with context menu and unread badge."""

    def __init__(self, daemon: Any) -> None:
        self._daemon = daemon
        self._tray_icon: Any = None
        self._menu: Any = None
        self._badge_count: int = 0
        self._initialized = False

    def _init_tray(self) -> None:
        """Initialize the system tray icon."""
        try:
            # Check if a display is available (headless guard)
            if not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY"):
                logger.info("No display server found, skipping system tray initialization")
                return

            from PySide6.QtWidgets import QSystemTrayIcon, QMenu, QApplication
            from PySide6.QtGui import QIcon, QPixmap, QPainter, QColor, QFont

            # Create app if needed
            app = QApplication.instance()
            if app is None:
                app = QApplication(sys.argv)

            self._tray_icon = QSystemTrayIcon()

            # Create maroon icon with badge
            pixmap = QPixmap(22, 22)
            pixmap.fill(QColor(0, 0, 0, 0))
            painter = QPainter(pixmap)
            painter.setRenderHint(QPainter.RenderHint.Antialiasing)

            # Draw maroon circle
            painter.setBrush(QColor("#A52A2A"))
            painter.setPen(QColor("#A52A2A"))
            painter.drawEllipse(1, 1, 20, 20)

            # Draw "LT" text
            painter.setPen(QColor("#FFFFFF"))
            font = QFont("Arial", 8, QFont.Weight.Bold)
            painter.setFont(font)
            painter.drawText(pixmap.rect(), 0x0084, "LT")  # AlignCenter
            painter.end()

            self._tray_icon.setIcon(QIcon(pixmap))

            # Context menu
            self._menu = QMenu()

            open_action = self._menu.addAction("Open LTalk")
            open_action.triggered.connect(self._open_app)

            new_chat_action = self._menu.addAction("New Chat")
            new_chat_action.triggered.connect(self._new_chat)

            mark_read_action = self._menu.addAction("Mark All as Read")
            mark_read_action.triggered.connect(self._mark_all_read)

            self._menu.addSeparator()

            quit_action = self._menu.addAction("Quit LTalk")
            quit_action.triggered.connect(self._quit)

            self._tray_icon.setContextMenu(self._menu)
            self._tray_icon.activated.connect(self._on_activated)
            self._tray_icon.show()

            self._initialized = True
            logger.info("System tray initialized")
        except Exception as e:
            logger.warning("Failed to initialize system tray: %s", e)

    def _on_activated(self, reason: int) -> None:
        """Handle tray icon activation."""
        # 2 = DoubleClick, 3 = Trigger (single click on some DEs)
        if reason in (2, 3):
            self._open_app()

    def _open_app(self) -> None:
        """Open the main LTalk window."""
        self._launch_app()

    def _new_chat(self) -> None:
        """Open LTalk and focus new chat."""
        self._launch_app()

    def _launch_app(self) -> None:
        """Launch the GUI in a detached process (no shell)."""
        try:
            subprocess.Popen(
                ["ltalk"],
                start_new_session=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as e:
            logger.warning("Failed to launch LTalk: %s", e)

    def _mark_all_read(self) -> None:
        """Mark all messages as read."""
        if self._daemon._db:
            self._daemon._db.execute("UPDATE chats SET unread_count = 0")
            self._daemon._db.commit()
        self.update_badge(0)

    def _quit(self) -> None:
        """Quit the daemon."""
        import asyncio
        loop = asyncio.get_event_loop()
        loop.create_task(self._daemon.stop())

    def update_badge(self, count: int) -> None:
        """Update the unread badge count on the tray icon."""
        self._badge_count = count
        if not self._initialized:
            self._init_tray()
            return

        try:
            from PySide6.QtWidgets import QSystemTrayIcon, QApplication
            from PySide6.QtGui import QIcon, QPixmap, QPainter, QColor, QFont

            pixmap = QPixmap(22, 22)
            pixmap.fill(QColor(0, 0, 0, 0))
            painter = QPainter(pixmap)
            painter.setRenderHint(QPainter.RenderHint.Antialiasing)

            # Draw maroon circle
            painter.setBrush(QColor("#A52A2A"))
            painter.setPen(QColor("#A52A2A"))
            painter.drawEllipse(1, 1, 20, 20)

            # Draw "LT" text
            painter.setPen(QColor("#FFFFFF"))
            font = QFont("Arial", 8, QFont.Weight.Bold)
            painter.setFont(font)
            painter.drawText(pixmap.rect(), 0x0084, "LT")

            # Draw badge
            if count > 0:
                painter.setBrush(QColor("#D32F2F"))
                painter.setPen(QColor("#D32F2F"))
                painter.drawEllipse(14, 0, 10, 10)
                painter.setPen(QColor("#FFFFFF"))
                badge_font = QFont("Arial", 6, QFont.Weight.Bold)
                painter.setFont(badge_font)
                badge_text = str(count) if count < 100 else "99+"
                painter.drawText(14, 0, 10, 10, 0x0084, badge_text)

            painter.end()
            self._tray_icon.setIcon(QIcon(pixmap))

            if count > 0:
                self._tray_icon.setToolTip(f"LTalk - {count} unread messages")
            else:
                self._tray_icon.setToolTip("LTalk")
        except Exception as e:
            logger.error("Failed to update tray badge: %s", e)

    def stop(self) -> None:
        """Stop the tray manager."""
        if self._tray_icon:
            self._tray_icon.hide()
