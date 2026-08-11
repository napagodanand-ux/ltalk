"""Tests for the end-to-end message pipeline."""

from __future__ import annotations

import time

import pytest

from ltalk_core.crypto.encrypt import MessageEncryptor
from ltalk_core.crypto.key_store import KeyStore
from ltalk_core.crypto.session_cache import SessionCache
from ltalk_core.crypto.signal_manager import SignalManager
from ltalk_core.db.connection import Database
from ltalk_core.db.migrations import run_migrations
from ltalk_core.db.messages import MessageRepository
from ltalk_core.types.message import Message, MessageType, MessageStatus


class TestMessagePipeline:
    """Tests for the complete message flow."""

    def _setup(self, tmp_path):
        db = Database(db_path=tmp_path / "test.db", encryption_key="test-key")
        db.connect()
        run_migrations(db)
        signal = SignalManager(db, require_libsignal=False)
        key_store = KeyStore(db)
        cache = SessionCache()
        encryptor = MessageEncryptor(signal, key_store, cache)
        msg_repo = MessageRepository(db)
        return db, signal, key_store, cache, encryptor, msg_repo

    def _create_chat(self, db, chat_id="chat-1"):
        import time as _time
        db.execute(
            "INSERT OR IGNORE INTO chats (id, is_group, created_at, updated_at) VALUES (?, 0, ?, ?)",
            (chat_id, int(_time.time()), int(_time.time())),
        )
        db.commit()

    def test_establish_session_requires_libsignal(self, tmp_path):
        """Without libsignal, establish_session should raise."""
        _, signal, _, _, _, _ = self._setup(tmp_path)
        with pytest.raises(RuntimeError, match="libsignal is required"):
            signal.establish_session({})

    def test_message_creation_and_storage(self, tmp_path):
        db, _, _, _, _, msg_repo = self._setup(tmp_path)
        self._create_chat(db)
        msg = Message(
            id="msg-test-1",
            chat_id="chat-1",
            sender_id="user-1",
            message_type=MessageType.TEXT,
            encrypted_content="encrypted-content",
            plaintext_content="Hello World",
            created_at=time.time(),
        )
        msg_repo.insert(msg)
        retrieved = msg_repo.get_by_id("msg-test-1")
        assert retrieved is not None
        assert retrieved.plaintext_content == "Hello World"
        assert retrieved.message_type == MessageType.TEXT
        db.close()

    def test_message_status_workflow(self, tmp_path):
        db, _, _, _, _, msg_repo = self._setup(tmp_path)
        self._create_chat(db)
        msg = Message(
            id="msg-status",
            chat_id="chat-1",
            sender_id="user-1",
            message_type=MessageType.TEXT,
            encrypted_content="encrypted",
            created_at=time.time(),
        )
        msg_repo.insert(msg)

        # Initially sent
        msg_repo.upsert_status("msg-status", "chat-1", "user-2", MessageStatus.SENT)
        status = msg_repo.get_status("msg-status", "user-2")
        assert status == MessageStatus.SENT

        # Delivered
        msg_repo.upsert_status("msg-status", "chat-1", "user-2", MessageStatus.DELIVERED)
        status = msg_repo.get_status("msg-status", "user-2")
        assert status == MessageStatus.DELIVERED

        # Read
        msg_repo.upsert_status("msg-status", "chat-1", "user-2", MessageStatus.READ)
        status = msg_repo.get_status("msg-status", "user-2")
        assert status == MessageStatus.READ
        db.close()

    def test_message_search(self, tmp_path):
        db, _, _, _, _, msg_repo = self._setup(tmp_path)
        self._create_chat(db)
        for i, text in enumerate(["Hello", "Goodbye", "Hello again", "Hi there"]):
            msg = Message(
                id=f"msg-search-{i}",
                chat_id="chat-1",
                sender_id="user-1",
                message_type=MessageType.TEXT,
                encrypted_content="encrypted",
                plaintext_content=text,
                created_at=time.time() + i,
            )
            msg_repo.insert(msg)

        results = msg_repo.search("Hello")
        assert len(results) == 2

        results = msg_repo.search("Goodbye")
        assert len(results) == 1
        db.close()

    def test_star_messages(self, tmp_path):
        db, _, _, _, _, msg_repo = self._setup(tmp_path)
        self._create_chat(db)
        msg = Message(
            id="msg-star",
            chat_id="chat-1",
            sender_id="user-1",
            message_type=MessageType.TEXT,
            encrypted_content="encrypted",
            plaintext_content="Important message",
            created_at=time.time(),
        )
        msg_repo.insert(msg)
        msg_repo.toggle_star("msg-star")
        starred = msg_repo.get_starred()
        assert len(starred) == 1
        assert starred[0].id == "msg-star"

        msg_repo.toggle_star("msg-star")
        starred = msg_repo.get_starred()
        assert len(starred) == 0
        db.close()
