"""Tests for the database module."""

import tempfile
import time

from ltalk_core.db.connection import Database
from ltalk_core.db.migrations import run_migrations
from ltalk_core.db.messages import MessageRepository
from ltalk_core.db.chats import ChatRepository
from ltalk_core.db.contacts import ContactRepository
from ltalk_core.db.queue import OfflineQueue
from ltalk_core.types.message import Message, MessageType, MessageStatus
from ltalk_core.types.chat import Chat, ChatMember


class TestDatabase:
    """Tests for the SQLCipher database connection."""

    def test_connect_and_migrate(self, tmp_path):
        db = Database(db_path=tmp_path / "test.db", encryption_key="test-key")
        db.connect()
        run_migrations(db)
        assert db.get_schema_version() == 2
        db.close()

    def test_execute_and_fetch(self, tmp_path):
        db = Database(db_path=tmp_path / "test.db", encryption_key="test-key")
        db.connect()
        run_migrations(db)
        db.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("test", "value"))
        db.commit()
        row = db.fetchone("SELECT * FROM settings WHERE key = ?", ("test",))
        assert row is not None
        assert row["value"] == "value"
        db.close()


class TestMessageRepository:
    """Tests for message CRUD operations."""

    def _setup_db(self, tmp_path):
        db = Database(db_path=tmp_path / "test.db", encryption_key="test-key")
        db.connect()
        run_migrations(db)
        return db

    def _create_chat(self, db, chat_id="chat-1"):
        import time as _time
        db.execute(
            "INSERT OR IGNORE INTO chats (id, is_group, created_at, updated_at) VALUES (?, 0, ?, ?)",
            (chat_id, int(_time.time()), int(_time.time())),
        )
        db.commit()

    def test_insert_and_get(self, tmp_path):
        db = self._setup_db(tmp_path)
        self._create_chat(db)
        repo = MessageRepository(db)
        msg = Message(
            id="msg-1",
            chat_id="chat-1",
            sender_id="user-1",
            message_type=MessageType.TEXT,
            encrypted_content="encrypted",
            plaintext_content="Hello",
            created_at=time.time(),
        )
        repo.insert(msg)
        retrieved = repo.get_by_id("msg-1")
        assert retrieved is not None
        assert retrieved.plaintext_content == "Hello"
        db.close()

    def test_get_by_chat(self, tmp_path):
        db = self._setup_db(tmp_path)
        self._create_chat(db)
        repo = MessageRepository(db)
        for i in range(5):
            msg = Message(
                id=f"msg-{i}",
                chat_id="chat-1",
                sender_id="user-1",
                message_type=MessageType.TEXT,
                encrypted_content="encrypted",
                plaintext_content=f"Message {i}",
                created_at=time.time() + i,
            )
            repo.insert(msg)
        messages = repo.get_by_chat("chat-1", limit=3)
        assert len(messages) == 3
        db.close()

    def test_mark_deleted_for_me(self, tmp_path):
        db = self._setup_db(tmp_path)
        self._create_chat(db)
        repo = MessageRepository(db)
        msg = Message(
            id="msg-1",
            chat_id="chat-1",
            sender_id="user-1",
            message_type=MessageType.TEXT,
            encrypted_content="encrypted",
            plaintext_content="Hello",
            created_at=time.time(),
        )
        repo.insert(msg)
        repo.mark_deleted_for_me("msg-1")
        retrieved = repo.get_by_id("msg-1")
        assert retrieved is not None
        assert retrieved.deleted_for_me is True
        db.close()

    def test_search(self, tmp_path):
        db = self._setup_db(tmp_path)
        self._create_chat(db)
        repo = MessageRepository(db)
        for i, text in enumerate(["Hello world", "Goodbye world", "Hello again"]):
            msg = Message(
                id=f"msg-{i}",
                chat_id="chat-1",
                sender_id="user-1",
                message_type=MessageType.TEXT,
                encrypted_content="encrypted",
                plaintext_content=text,
                created_at=time.time() + i,
            )
            repo.insert(msg)
        results = repo.search("Hello")
        assert len(results) == 2
        db.close()


class TestChatRepository:
    """Tests for chat CRUD operations."""

    def _setup_db(self, tmp_path):
        db = Database(db_path=tmp_path / "test.db", encryption_key="test-key")
        db.connect()
        run_migrations(db)
        return db

    def test_insert_and_get(self, tmp_path):
        db = self._setup_db(tmp_path)
        repo = ChatRepository(db)
        chat = Chat(
            id="chat-1",
            is_group=False,
            created_at=time.time(),
            updated_at=time.time(),
            members=[
                ChatMember(user_id="user-1", display_name="Alice"),
                ChatMember(user_id="user-2", display_name="Bob"),
            ],
        )
        repo.insert(chat)
        for member in chat.members:
            repo.insert_member("chat-1", member)
        retrieved = repo.get_by_id("chat-1")
        assert retrieved is not None
        assert retrieved.display_name == "Alice"
        assert len(retrieved.members) == 2
        db.close()

    def test_unread_count(self, tmp_path):
        db = self._setup_db(tmp_path)
        repo = ChatRepository(db)
        chat = Chat(id="chat-1", created_at=time.time(), updated_at=time.time())
        repo.insert(chat)
        repo.increment_unread("chat-1")
        repo.increment_unread("chat-1")
        retrieved = repo.get_by_id("chat-1")
        assert retrieved.unread_count == 2
        repo.clear_unread("chat-1")
        retrieved = repo.get_by_id("chat-1")
        assert retrieved.unread_count == 0
        db.close()

    def test_toggle_mute(self, tmp_path):
        db = self._setup_db(tmp_path)
        repo = ChatRepository(db)
        chat = Chat(id="chat-1", created_at=time.time(), updated_at=time.time())
        repo.insert(chat)
        assert repo.toggle_mute("chat-1") is True
        assert repo.toggle_mute("chat-1") is False
        db.close()

    def test_total_unread(self, tmp_path):
        db = self._setup_db(tmp_path)
        repo = ChatRepository(db)
        for i in range(3):
            chat = Chat(id=f"chat-{i}", created_at=time.time(), updated_at=time.time())
            repo.insert(chat)
            for _ in range(i + 1):
                repo.increment_unread(f"chat-{i}")
        total = repo.get_total_unread()
        assert total == 6  # 1 + 2 + 3
        db.close()


class TestOfflineQueue:
    """Tests for the offline message queue."""

    def _setup_db(self, tmp_path):
        db = Database(db_path=tmp_path / "test.db", encryption_key="test-key")
        db.connect()
        run_migrations(db)
        return db

    def test_enqueue_and_dequeue(self, tmp_path):
        db = self._setup_db(tmp_path)
        queue = OfflineQueue(db)
        queue_id = queue.enqueue("chat-1", "encrypted-data", "text")
        assert queue_id > 0
        pending = queue.dequeue()
        assert len(pending) == 1
        assert pending[0]["chat_id"] == "chat-1"
        db.close()

    def test_mark_sent(self, tmp_path):
        db = self._setup_db(tmp_path)
        queue = OfflineQueue(db)
        queue_id = queue.enqueue("chat-1", "encrypted-data", "text")
        queue.mark_sent(queue_id)
        pending = queue.dequeue()
        assert len(pending) == 0
        db.close()

    def test_mark_failed_increments_retry(self, tmp_path):
        db = self._setup_db(tmp_path)
        queue = OfflineQueue(db)
        queue_id = queue.enqueue("chat-1", "encrypted-data", "text")
        queue.mark_failed(queue_id)
        pending = queue.dequeue()
        assert len(pending) == 1
        assert pending[0]["retry_count"] == 1
        db.close()
