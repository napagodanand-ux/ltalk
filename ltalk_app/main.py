"""LTalk GUI entry point."""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root before reading env vars
_project_root = Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

from PySide6.QtCore import QUrl
from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlApplicationEngine

from ltalk_core.db.connection import Database
from ltalk_core.db.migrations import run_migrations
from ltalk_core.supabase.auth import SupabaseAuth
from ltalk_core.supabase.client import SupabaseClient, SupabaseConfig
from ltalk_core.supabase.database import SupabaseDatabase
from ltalk_core.supabase.realtime import SupabaseRealtime
from ltalk_core.supabase.storage import SupabaseStorage

try:
    import qasync
except ImportError:
    qasync = None  # type: ignore[assignment]

from .backend import Backend
from .models.chat_list_model import ChatListModel
from .models.message_list_model import MessageListModel
from .models.status_model import StatusModel
from .theme import Theme

from ltalk_core.logging import setup_logging as _setup_structured_logging

logger = logging.getLogger("ltalk")

# Supabase configuration — set these via environment or config file
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

_qml_dir = Path(__file__).parent / "resources" / "qml"


def setup_logging() -> None:
    log_dir = Path.home() / ".local" / "share" / "ltalk" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    _setup_structured_logging(level="INFO")

    # Also log to file
    file_handler = logging.FileHandler(log_dir / "ltalk.log")
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)-5s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    logging.getLogger().addHandler(file_handler)


def _run_sync() -> None:
    """Run the application synchronously (no qasync)."""
    app = QGuiApplication(sys.argv)
    app.setApplicationName("LTalk")
    app.setOrganizationName("LTalk")

    engine = QQmlApplicationEngine()

    # Expose Theme singleton
    theme = Theme()
    engine.rootContext().setContextProperty("Theme", theme)

    qml_path = _qml_dir / "main.qml"
    engine.load(QUrl.fromLocalFile(str(qml_path)))

    if not engine.rootObjects():
        logger.error("Failed to load QML")
        sys.exit(1)

    app.exec()


def main() -> None:
    """Entry point."""
    setup_logging()
    logger.info("Starting LTalk GUI")

    if qasync is None:
        _run_sync()
        return

    app = QGuiApplication(sys.argv)
    app.setApplicationName("LTalk")
    app.setOrganizationName("LTalk")

    loop = qasync.QEventLoop(app)
    asyncio.set_event_loop(loop)

    async def _bootstrap() -> None:
        try:
            await _main_async(app)
        except Exception:
            logger.exception("LTalk initialization failed")
            app.exit(1)

    loop.create_task(_bootstrap())

    with loop:
        loop.run_forever()


async def _main_async(app: QGuiApplication) -> None:
    """Initialize the application on the running qasync loop."""
    # Initialize database
    db = Database()
    db.connect()
    run_migrations(db)

    # Initialize Supabase client
    config = SupabaseConfig(url=SUPABASE_URL, anon_key=SUPABASE_ANON_KEY)
    supabase = SupabaseClient(config)
    await supabase.initialize()

    # Set up QML engine
    engine = QQmlApplicationEngine()

    # Expose Theme singleton
    theme = Theme()
    engine.rootContext().setContextProperty("Theme", theme)

    # Create and expose backend to QML
    auth = SupabaseAuth(supabase)
    database = SupabaseDatabase(supabase)
    storage = SupabaseStorage(supabase)

    # Create models
    chatListModel = ChatListModel()
    messageListModel = MessageListModel()
    statusModel = StatusModel()

    backend = Backend(
        db=db,
        supabase=supabase,
        auth=auth,
        database=database,
        storage=storage,
        chat_list_model=chatListModel,
        message_list_model=messageListModel,
        status_model=statusModel,
    )
    await backend.initialize()

    engine.rootContext().setContextProperty("backend", backend)
    engine.rootContext().setContextProperty("chatListModel", chatListModel)
    engine.rootContext().setContextProperty("messageListModel", messageListModel)
    engine.rootContext().setContextProperty("statusModel", statusModel)

    # Load main QML
    qml_path = _qml_dir / "main.qml"
    engine.load(QUrl.fromLocalFile(str(qml_path)))

    if not engine.rootObjects():
        logger.error("Failed to load QML")
        app.exit(1)
        return

    def _on_about_to_quit() -> None:
        try:
            if backend._realtime:
                backend._realtime.stop()
        finally:
            db.close()

    app.aboutToQuit.connect(_on_about_to_quit)


if __name__ == "__main__":
    main()
