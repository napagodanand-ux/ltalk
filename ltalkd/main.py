"""LTalk daemon entry point — runs as background service."""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
from pathlib import Path

from dotenv import load_dotenv

_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

from ltalk_core.db.connection import Database
from ltalk_core.db.chats import ChatRepository
from ltalk_core.db.migrations import run_migrations
from ltalk_core.supabase.auth import SupabaseAuth
from ltalk_core.supabase.client import SupabaseClient, SupabaseConfig
from ltalk_core.supabase.database import SupabaseDatabase

from .ipc_server import IpcServer
from .media_keys import GlobalHotkeyHandler
from .notification_sender import NotificationSender
from .presence import PresenceHeartbeat
from .queue_processor import QueueProcessor
from .realtime_listener import RealtimeListener
from .tray_manager import TrayManager

from ltalk_core.logging import setup_logging as _setup_structured_logging

logger = logging.getLogger("ltalkd")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


def setup_logging() -> None:
    log_dir = Path.home() / ".local" / "share" / "ltalk" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    _setup_structured_logging(level="INFO")

    file_handler = logging.FileHandler(log_dir / "ltalkd.log")
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)-5s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    logging.getLogger().addHandler(file_handler)


class Daemon:
    """Main daemon process managing background services."""

    def __init__(self) -> None:
        self._running = False
        self._db: Database | None = None
        self._chat_repo: ChatRepository | None = None
        self._supabase: SupabaseClient | None = None
        self._realtime: RealtimeListener | None = None
        self._notifications: NotificationSender | None = None
        self._tray: TrayManager | None = None
        self._ipc: IpcServer | None = None
        self._queue: QueueProcessor | None = None
        self._presence: PresenceHeartbeat | None = None
        self._global_hotkeys: GlobalHotkeyHandler | None = None

    async def start(self) -> None:
        """Start all daemon services."""
        setup_logging()
        logger.info("Starting LTalk daemon (PID: %d)", os.getpid())

        # Initialize database
        self._db = Database()
        self._db.connect()
        run_migrations(self._db)
        self._chat_repo = ChatRepository(self._db)

        # Initialize Supabase
        config = SupabaseConfig(url=SUPABASE_URL, anon_key=SUPABASE_ANON_KEY)
        self._supabase = SupabaseClient(config)
        await self._supabase.initialize()

        # Check for existing session
        row = self._db.fetchone(
            "SELECT id, jwt, refresh_token FROM local_user LIMIT 1"
        )
        if row and row["jwt"]:
            self._supabase.set_tokens(row["jwt"], row["refresh_token"])

        # Start services
        self._notifications = NotificationSender()
        self._tray = TrayManager(self)
        self._ipc = IpcServer(self)
        self._queue = QueueProcessor(self._db, self._supabase)
        self._presence = PresenceHeartbeat(self._supabase)
        self._realtime = RealtimeListener(self._supabase, self._on_message_received)

        # Global hotkeys
        self._global_hotkeys = GlobalHotkeyHandler()
        self._global_hotkeys.register("ctrl+alt+l", self._focus_window)
        self._global_hotkeys.start()

        # Connect services
        await self._ipc.start()
        if self._supabase.is_authenticated:
            await self._realtime.connect()
            await self._presence.start()
            await self._queue.start()

        self._running = True
        logger.info("LTalk daemon started")

        # Handle signals
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(self.stop()))

        # Run forever
        try:
            while self._running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Stop all daemon services."""
        logger.info("Stopping LTalk daemon")
        self._running = False

        if self._global_hotkeys:
            self._global_hotkeys.stop()
        if self._realtime:
            await self._realtime.disconnect()
        if self._presence:
            await self._presence.stop()
        if self._ipc:
            await self._ipc.stop()
        if self._tray:
            self._tray.stop()
        if self._supabase:
            await self._supabase.close()
        if self._db:
            self._db.close()

        logger.info("LTalk daemon stopped")

    def _focus_window(self) -> None:
        """Focus/raise the LTalk window."""
        try:
            import subprocess
            subprocess.Popen(["ltalk"], start_new_session=True)
        except Exception as e:
            logger.debug("Failed to focus window: %s", e)

    async def _on_message_received(self, payload: dict) -> None:
        """Handle incoming message from Realtime."""
        if payload.get("eventType") != "INSERT":
            return
        record = payload.get("record", {})
        chat_id = record.get("chat_id")
        sender_id = record.get("sender_id")

        # Get sender name
        sender_name = "Unknown"
        try:
            profile = await self._supabase.database.select(
                "profiles", filters={"id": f"eq.{sender_id}"}
            )
            if profile:
                sender_name = profile[0].get("display_name", "Unknown")
        except Exception:
            pass

        # Send notification
        if self._notifications:
            self._notifications.send_message_notification(
                sender_name=sender_name,
                message="[New message]",
                chat_id=chat_id,
            )

        # Update tray badge
        if self._tray and self._chat_repo:
            total = self._chat_repo.get_total_unread()
            self._tray.update_badge(total + 1)

    def set_auth(self, jwt: str, refresh_token: str, user_id: str) -> None:
        """Update authentication tokens from GUI."""
        if self._supabase:
            self._supabase.set_tokens(jwt, refresh_token)
        if self._db:
            self._db.execute(
                "UPDATE local_user SET jwt = ?, refresh_token = ? WHERE id = ?",
                (jwt, refresh_token, user_id),
            )
            self._db.commit()

    async def reconnect_realtime(self) -> None:
        """Reconnect the Realtime listener."""
        if self._realtime and self._supabase and self._supabase.is_authenticated:
            await self._realtime.disconnect()
            await self._realtime.connect()


def main() -> None:
    """Entry point for ltalkd."""
    daemon = Daemon()
    try:
        asyncio.run(daemon.start())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
