"""Shared test fixtures."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Generator

import pytest

os.environ.setdefault("LTALK_ALLOW_PLAINTEXT_DB", "1")
os.environ.setdefault("LTALK_ALLOW_FALLBACK_CRYPTO", "1")

from ltalk_core.crypto.encrypt import MessageEncryptor
from ltalk_core.crypto.key_store import KeyStore
from ltalk_core.crypto.session_cache import SessionCache
from ltalk_core.crypto.signal_manager import SignalManager
from ltalk_core.db.chats import ChatRepository
from ltalk_core.db.connection import Database
from ltalk_core.db.messages import MessageRepository
from ltalk_core.db.migrations import run_migrations
from ltalk_core.db.queue import OfflineQueue


class MockDb:
    """Minimal in-memory database mock for unit tests that don't need persistence."""

    def execute(self, query: str, params: tuple = ()) -> None:
        pass

    def commit(self) -> None:
        pass

    def fetchone(self, query: str, params: tuple = ()) -> dict | None:
        return None

    def fetchall(self, query: str, params: tuple = ()) -> list[dict]:
        return []


@pytest.fixture
def mock_db() -> MockDb:
    """In-memory mock DB for lightweight tests."""
    return MockDb()


@pytest.fixture
def tmp_db(tmp_path: Path) -> Generator[Database, None, None]:
    """Real SQLCipher database in a temp directory for integration tests."""
    db = Database(db_path=tmp_path / "test.db", encryption_key="test-key")
    db.connect()
    run_migrations(db)
    yield db
    db.close()


@pytest.fixture
def signal_manager(tmp_db: Database) -> SignalManager:
    """SignalManager backed by a real temp database, fallback mode."""
    return SignalManager(tmp_db, require_libsignal=False)


@pytest.fixture
def key_store(tmp_db: Database) -> KeyStore:
    """KeyStore backed by a real temp database."""
    return KeyStore(tmp_db)


@pytest.fixture
def session_cache() -> SessionCache:
    """Fresh in-memory session cache."""
    return SessionCache()


@pytest.fixture
def encryptor(
    signal_manager: SignalManager,
    key_store: KeyStore,
    session_cache: SessionCache,
) -> MessageEncryptor:
    """Fully wired MessageEncryptor."""
    return MessageEncryptor(signal_manager, key_store, session_cache)


@pytest.fixture
def message_repo(tmp_db: Database) -> MessageRepository:
    """MessageRepository backed by a real temp database."""
    return MessageRepository(tmp_db)


@pytest.fixture
def chat_repo(tmp_db: Database) -> ChatRepository:
    """ChatRepository backed by a real temp database."""
    return ChatRepository(tmp_db)


@pytest.fixture
def offline_queue(tmp_db: Database) -> OfflineQueue:
    """OfflineQueue backed by a real temp database."""
    return OfflineQueue(tmp_db)


@pytest.fixture
def create_chat(tmp_db: Database):
    """Helper fixture to create a chat in the DB."""
    def _create(chat_id: str = "chat-1") -> None:
        import time as _time
        now = int(_time.time())
        tmp_db.execute(
            "INSERT OR IGNORE INTO chats (id, is_group, created_at, updated_at) VALUES (?, 0, ?, ?)",
            (chat_id, now, now),
        )
        tmp_db.commit()
    return _create
