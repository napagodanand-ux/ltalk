"""Tests for controllers."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ltalk_app.controllers.auth import AuthController
from ltalk_app.controllers.chat import ChatController
from ltalk_app.controllers.contact import ContactController
from ltalk_app.controllers.message import MessageController
from ltalk_app.controllers.settings import SettingsController
from ltalk_core.types.chat import Chat, ChatMember
from ltalk_core.types.message import Message, MessageType


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.fetchone.return_value = None
    db.fetchall.return_value = []
    return db


@pytest.fixture
def mock_supabase():
    sb = AsyncMock()
    sb.is_authenticated = True
    sb._access_token = "test-jwt"
    return sb


@pytest.fixture
def mock_database():
    return AsyncMock()


@pytest.fixture
def mock_storage():
    return AsyncMock()


@pytest.fixture
def mock_signal_manager():
    sm = MagicMock()
    sm.identity_key_pair = None
    sm.load_identity_key_pair.return_value = None
    sm.generate_identity_key_pair.return_value = (b"priv", b"pub")
    sm.generate_pre_keys.return_value = [{"id": 1, "public_key": b"pk1", "private_key": b"prk1"}]
    sm.generate_signed_pre_key.return_value = {"id": 1, "public_key": b"spk", "private_key": b"sprk", "signature": b"sig"}
    return sm


@pytest.fixture
def mock_key_store():
    return MagicMock()


@pytest.fixture
def mock_encryptor():
    enc = AsyncMock()
    enc.encrypt_message.return_value = "encrypted-content"
    enc.decrypt_message.return_value = "decrypted-content"
    return enc


@pytest.fixture
def mock_contact_repo():
    repo = MagicMock()
    repo.get_all.return_value = []
    repo.is_blocked.return_value = False
    return repo


@pytest.fixture
def mock_chat_repo():
    repo = MagicMock()
    repo.get_all.return_value = []
    repo.get_direct_chat.return_value = None
    repo.get_total_unread.return_value = 0
    return repo


@pytest.fixture
def mock_message_repo():
    repo = MagicMock()
    repo.get_by_chat.return_value = []
    repo.get_by_id.return_value = None
    repo.get_last_message.return_value = None
    repo.get_starred.return_value = []
    repo.cleanup_disappeared.return_value = 0
    return repo


@pytest.fixture
def mock_offline_queue():
    q = MagicMock()
    q.dequeue.return_value = []
    return q


# --- AuthController tests ---

class TestAuthController:
    def test_init(self, mock_db, mock_supabase, mock_database, mock_signal_manager, mock_key_store, mock_encryptor):
        from ltalk_core.supabase.auth import SupabaseAuth
        auth = SupabaseAuth(mock_supabase)
        ctrl = AuthController(mock_db, mock_supabase, auth, mock_database, mock_signal_manager, mock_key_store, mock_encryptor)
        assert ctrl is not None


# --- ChatController tests ---

class TestChatController:
    def test_init(self, mock_chat_repo, mock_message_repo, mock_database):
        ctrl = ChatController(mock_chat_repo, mock_message_repo, mock_database)
        assert ctrl is not None

    def test_get_direct_chat(self, mock_chat_repo, mock_message_repo, mock_database):
        ctrl = ChatController(mock_chat_repo, mock_message_repo, mock_database)
        mock_chat_repo.get_direct_chat.return_value = None
        result = ctrl.get_direct_chat("user-2")
        assert result is None
        mock_chat_repo.get_direct_chat.assert_called_once_with("user-2")

    def test_get_all_chats(self, mock_chat_repo, mock_message_repo, mock_database):
        ctrl = ChatController(mock_chat_repo, mock_message_repo, mock_database)
        mock_chat_repo.get_all.return_value = []
        result = ctrl.get_all_chats()
        assert result == []

    def test_toggle_mute(self, mock_chat_repo, mock_message_repo, mock_database):
        ctrl = ChatController(mock_chat_repo, mock_message_repo, mock_database)
        mock_chat_repo.toggle_mute.return_value = True
        result = ctrl.toggle_mute("chat-1")
        assert result is True
        mock_chat_repo.toggle_mute.assert_called_once_with("chat-1")

    def test_toggle_archive(self, mock_chat_repo, mock_message_repo, mock_database):
        ctrl = ChatController(mock_chat_repo, mock_message_repo, mock_database)
        mock_chat_repo.toggle_archive.return_value = True
        result = ctrl.toggle_archive("chat-1")
        assert result is True

    def test_get_total_unread(self, mock_chat_repo, mock_message_repo, mock_database):
        ctrl = ChatController(mock_chat_repo, mock_message_repo, mock_database)
        mock_chat_repo.get_total_unread.return_value = 5
        assert ctrl.get_total_unread() == 5


# --- MessageController tests ---

class TestMessageController:
    def test_get_messages(self, mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor):
        ctrl = MessageController(mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor)
        mock_message_repo.get_by_chat.return_value = []
        result = ctrl.get_messages("chat-1")
        assert result == []

    def test_get_by_id(self, mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor):
        ctrl = MessageController(mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor)
        mock_message_repo.get_by_id.return_value = None
        result = ctrl.get_by_id("msg-1")
        assert result is None

    def test_delete_for_me(self, mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor):
        ctrl = MessageController(mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor)
        ctrl.delete_for_me("msg-1")
        mock_message_repo.mark_deleted_for_me.assert_called_once_with("msg-1")

    def test_toggle_star(self, mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor):
        ctrl = MessageController(mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor)
        ctrl.toggle_star("msg-1")
        mock_message_repo.toggle_star.assert_called_once_with("msg-1")

    def test_cleanup_disappeared(self, mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor):
        ctrl = MessageController(mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor)
        mock_message_repo.cleanup_disappeared.return_value = 3
        result = ctrl.cleanup_disappeared()
        assert result == 3

    def test_search(self, mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor):
        ctrl = MessageController(mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor)
        mock_message_repo.search.return_value = []
        result = ctrl.search("hello")
        assert result == []

    def test_get_starred(self, mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor):
        ctrl = MessageController(mock_db, mock_supabase, mock_database, mock_storage, mock_message_repo, mock_chat_repo, mock_offline_queue, mock_encryptor)
        mock_message_repo.get_starred.return_value = []
        result = ctrl.get_starred()
        assert result == []


# --- ContactController tests ---

class TestContactController:
    def test_init(self, mock_contact_repo, mock_database):
        ctrl = ContactController(mock_contact_repo, mock_database)
        assert ctrl is not None

    def test_get_contacts(self, mock_contact_repo, mock_database):
        ctrl = ContactController(mock_contact_repo, mock_database)
        mock_contact_repo.get_all.return_value = []
        result = ctrl.get_contacts("user-1")
        assert result == []

    def test_is_blocked(self, mock_contact_repo, mock_database):
        ctrl = ContactController(mock_contact_repo, mock_database)
        mock_contact_repo.is_blocked.return_value = True
        result = ctrl.is_blocked("user-1", "user-2")
        assert result is True


# --- SettingsController tests ---

class TestSettingsController:
    def test_init(self, mock_db, mock_database, mock_storage):
        ctrl = SettingsController(mock_db, mock_database, mock_storage)
        assert ctrl is not None

    def test_get_profile(self, mock_db, mock_database, mock_storage):
        ctrl = SettingsController(mock_db, mock_database, mock_storage)
        mock_db.fetchone.return_value = {"display_name": "Alice", "about": "Hi", "avatar_url": None}
        result = ctrl.get_profile("user-1")
        assert result is not None
        assert result["display_name"] == "Alice"
