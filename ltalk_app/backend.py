"""Backend bridge between QML UI and Python business logic.

Thin QObject facade that delegates to domain controllers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Optional

from PySide6.QtCore import QObject, Property, Signal, Slot

from ltalk_core.crypto.encrypt import MessageEncryptor
from ltalk_core.crypto.key_store import KeyStore
from ltalk_core.crypto.session_cache import SessionCache
from ltalk_core.crypto.signal_manager import SignalManager
from ltalk_core.db.chats import ChatRepository
from ltalk_core.db.connection import Database
from ltalk_core.db.contacts import ContactRepository
from ltalk_core.db.messages import MessageRepository
from ltalk_core.db.queue import OfflineQueue
from ltalk_core.ipc.protocol import IpcMessage, IpcMessageType
from ltalk_core.supabase.auth import SupabaseAuth
from ltalk_core.supabase.client import SupabaseClient
from ltalk_core.supabase.database import SupabaseDatabase
from ltalk_core.supabase.realtime import SupabaseRealtime
from ltalk_core.supabase.storage import SupabaseStorage
from ltalk_core.supabase.token_manager import TokenManager
from ltalk_core.timestamps import to_epoch
from ltalk_core.types.chat import Chat, ChatMember, ChatRole
from ltalk_core.types.message import Message, MessageStatus, MessageType
from ltalk_core.validation import (
    validate_display_name,
    validate_email,
    validate_file_path,
    validate_file_type,
    validate_message_content,
    validate_password,
    validate_query,
    validate_uuid,
)

from .controllers.auth import AuthController
from .controllers.chat import ChatController
from .controllers.contact import ContactController
from .controllers.message import MessageController
from .controllers.settings import SettingsController
from .ipc_client import IpcClient
from .models.chat_list_model import ChatListModel
from .models.message_list_model import MessageListModel
from .models.status_model import StatusModel

logger = logging.getLogger(__name__)


def _safe_ensure_future(coro, label: str = "") -> asyncio.Future:
    """Schedule a coroutine and log exceptions."""
    def _done(f: asyncio.Future):
        if f.cancelled():
            return
        exc = f.exception()
        if exc:
            logger.error("Async task %s failed: %s", label, exc)

    fut = asyncio.ensure_future(coro)
    fut.add_done_callback(_done)
    return fut


class Backend(QObject):
    """Thin facade exposed to QML as context property.

    Delegates all business logic to controllers while keeping
    Qt signals, slots, and UI-facing state here.
    """

    # Signals for QML
    authStateChanged = Signal(bool)
    currentChatChanged = Signal(str)
    messageReceived = Signal(str, str, str)  # chat_id, sender_id, content
    chatListChanged = Signal()
    messageListChanged = Signal(str)  # chat_id
    presenceChanged = Signal(str, str)  # user_id, status
    typingChanged = Signal(str, str, bool)  # chat_id, user_id, is_typing
    errorOccurred = Signal(str)
    connectionChanged = Signal(bool)
    profileUpdated = Signal()
    isAuthenticated = Signal(bool)
    isAuthenticatedChanged = Signal()
    searchResults = Signal(str)  # JSON string of results

    def __init__(
        self,
        db: Database,
        supabase: SupabaseClient,
        auth: SupabaseAuth,
        database: SupabaseDatabase,
        storage: SupabaseStorage,
        chat_list_model: ChatListModel,
        message_list_model: MessageListModel,
        status_model: StatusModel,
        parent: Optional[QObject] = None,
    ) -> None:
        super().__init__(parent)
        self._db = db
        self._supabase = supabase
        self._auth = auth
        self._database = database

        # Models
        self._chatListModel = chat_list_model
        self._messageListModel = message_list_model
        self._statusModel = status_model

        # Repositories
        self._chat_repo = ChatRepository(db)
        self._message_repo = MessageRepository(db)
        self._contact_repo = ContactRepository(db)
        self._offline_queue = OfflineQueue(db)

        # Crypto
        require_libsignal = os.environ.get("LTALK_ALLOW_FALLBACK_CRYPTO", "0") != "1"
        self._signal_manager = SignalManager(db, require_libsignal=require_libsignal)
        self._key_store = KeyStore(db)
        self._session_cache = SessionCache()
        self._encryptor = MessageEncryptor(self._signal_manager, self._key_store, self._session_cache)

        # Controllers
        self._auth_ctrl = AuthController(db, supabase, auth, database, self._signal_manager, self._key_store, self._encryptor)
        self._chat_ctrl = ChatController(self._chat_repo, self._message_repo, database)
        self._message_ctrl = MessageController(db, supabase, database, storage, self._message_repo, self._chat_repo, self._offline_queue, self._encryptor)
        self._contact_ctrl = ContactController(self._contact_repo, database)
        self._settings_ctrl = SettingsController(db, database, storage)

        # State
        self._current_user_id: str = ""
        self._current_chat_id: str = ""
        self._realtime: Optional[SupabaseRealtime] = None
        self._is_connected = False
        self._is_authenticated = False
        self._refresh_lock = asyncio.Lock()
        self._ipc: Optional[IpcClient] = None
        self._token_manager: Optional[TokenManager] = None
        self._queue_drained = False
        self._disappearing_task: Optional[asyncio.Future] = None

    @Property(bool, notify=isAuthenticatedChanged)
    def isAuthenticated(self) -> bool:
        return self._is_authenticated

    # --- Lifecycle ---

    async def initialize(self) -> None:
        """Initialize the backend after Qt is ready."""
        session = self._auth_ctrl.get_stored_session()
        if session is None:
            return

        self._ensure_token_manager()
        await self._connect_ipc()

        jwt_expires = session["jwt_expires_at"]
        if time.time() < jwt_expires:
            self._current_user_id = session["id"]
            self._supabase.set_tokens(session["jwt"], session["refresh_token"])
            self._set_authenticated(True)
            await self._setup_realtime()
            await self._sync_data()
        else:
            async with self._refresh_lock:
                try:
                    user_id, new_jwt, expires_at = await self._auth_ctrl.refresh_token(session["refresh_token"])
                    self._current_user_id = user_id
                    self._set_authenticated(True)
                    await self._setup_realtime()
                    await self._sync_data()
                except Exception as e:
                    logger.error("Token refresh failed: %s", e)
                    self._set_authenticated(False)

    async def shutdown(self) -> None:
        """Clean up resources."""
        if self._token_manager:
            await self._token_manager.stop()
        if self._ipc:
            try:
                await self._ipc.send(IpcMessage.gui_closed())
            except Exception:
                pass
            await self._ipc.disconnect()
        if self._realtime:
            await self._realtime.disconnect()
        if self._supabase.is_authenticated:
            try:
                await self._auth_ctrl.sign_out()
            except Exception as e:
                logger.debug("Sign out failed (non-critical): %s", e)

    def _set_authenticated(self, value: bool) -> None:
        self._is_authenticated = value
        self.isAuthenticatedChanged.emit()
        self.authStateChanged.emit(value)

    # --- Auth Slots ---

    @Slot(str, str)
    def login(self, email: str, password: str) -> None:
        try:
            email = validate_email(email)
            password = validate_password(password)
        except Exception as e:
            self.errorOccurred.emit(str(e))
            return
        _safe_ensure_future(self._login_async(email, password), "login")

    async def _login_async(self, email: str, password: str) -> None:
        try:
            self._current_user_id = await self._auth_ctrl.sign_in(email, password)
            self._set_authenticated(True)
            self._ensure_token_manager()
            await self._connect_ipc()
            await self._setup_realtime()
            await self._sync_data()
        except Exception as e:
            logger.error("Login failed: %s", e)
            self.errorOccurred.emit(str(e))

    @Slot(str, str, str)
    def register(self, email: str, password: str, display_name: str) -> None:
        try:
            email = validate_email(email)
            password = validate_password(password)
            display_name = validate_display_name(display_name)
        except Exception as e:
            self.errorOccurred.emit(str(e))
            return
        _safe_ensure_future(self._register_async(email, password, display_name), "register")

    async def _register_async(self, email: str, password: str, display_name: str) -> None:
        try:
            self._current_user_id = await self._auth_ctrl.sign_up(email, password, display_name)
            self._set_authenticated(True)
            self._ensure_token_manager()
            await self._connect_ipc()
            await self._setup_realtime()
            await self._sync_data()
        except Exception as e:
            logger.error("Registration failed: %s", e)
            self.errorOccurred.emit(str(e))

    @Slot()
    def logout(self) -> None:
        _safe_ensure_future(self._logout_async(), "logout")

    async def _logout_async(self) -> None:
        self._set_authenticated(False)
        self._current_user_id = ""
        self._queue_drained = False
        self._disappearing_task = None
        if self._realtime:
            await self._realtime.disconnect()
            self._realtime = None
        try:
            await self._auth_ctrl.sign_out()
        except Exception:
            pass

    # --- Chat Slots ---

    @Slot(str)
    def openChat(self, chat_id: str) -> None:
        try:
            chat_id = validate_uuid(chat_id, "chat ID")
        except Exception as e:
            self.errorOccurred.emit(str(e))
            return
        self._current_chat_id = chat_id
        self._chat_repo.clear_unread(chat_id)
        self.currentChatChanged.emit(chat_id)
        self.chatListChanged.emit()
        _safe_ensure_future(self._load_messages_async(chat_id), "loadMessages")
        _safe_ensure_future(self._mark_read_async(chat_id), "markRead")

    async def _load_messages_async(self, chat_id: str) -> None:
        messages = self._message_ctrl.get_messages(chat_id)
        msg_dicts = []
        for msg in messages:
            msg_dicts.append({
                "messageId": msg.id,
                "senderId": msg.sender_id,
                "content": msg.plaintext_content or "",
                "messageType": msg.message_type.value,
                "timestamp": msg.created_at,
                "isSent": msg.sender_id == self._current_user_id,
                "status": msg.status.value if msg.status else "sent",
                "replyTo": msg.reply_to or "",
                "isForwarded": msg.is_forwarded,
                "isEdited": msg.is_edited,
                "isDeleted": msg.deleted_for_me,
                "senderName": "",
            })
        self._messageListModel.update_messages(msg_dicts)
        self.messageListChanged.emit(chat_id)

    async def _mark_read_async(self, chat_id: str) -> None:
        await self._message_ctrl.mark_read(chat_id, self._current_user_id)

    @Slot(str)
    def createChat(self, other_user_id: str) -> None:
        _safe_ensure_future(self._createChat_async(other_user_id), "createChat")

    async def _createChat_async(self, other_user_id: str) -> None:
        existing = self._chat_ctrl.get_direct_chat(other_user_id)
        if existing:
            self.chatListChanged.emit()
            return
        await self._chat_ctrl.create_direct_chat(self._current_user_id, other_user_id)
        self.chatListChanged.emit()

    @Slot(str, str)
    def createGroup(self, name: str, member_ids_json: str) -> None:
        _safe_ensure_future(self._createGroup_async(name, member_ids_json), "createGroup")

    async def _createGroup_async(self, name: str, member_ids_json: str) -> None:
        await self._chat_ctrl.create_group(self._current_user_id, name, member_ids_json)
        self.chatListChanged.emit()

    @Slot(str)
    def sendMessage(self, content: str) -> None:
        if not self._current_chat_id or not self._current_user_id:
            return
        try:
            content = validate_message_content(content)
        except Exception as e:
            self.errorOccurred.emit(str(e))
            return
        _safe_ensure_future(self._sendMessage_async(content), "sendMessage")

    async def _sendMessage_async(self, content: str) -> None:
        await self._message_ctrl.send_text(self._current_chat_id, self._current_user_id, content)
        self.messageListChanged.emit(self._current_chat_id)
        self.chatListChanged.emit()

    @Slot(str, str)
    def sendFile(self, file_path: str, file_type: str) -> None:
        if not self._current_chat_id or not self._current_user_id:
            return
        try:
            file_path = validate_file_path(file_path)
            validate_file_type(file_path, file_type)
        except Exception as e:
            self.errorOccurred.emit(str(e))
            return
        _safe_ensure_future(self._sendFile_async(file_path, file_type), "sendFile")

    async def _sendFile_async(self, file_path: str, file_type: str) -> None:
        message_id = await self._message_ctrl.send_file(
            self._current_chat_id, self._current_user_id, file_path, file_type
        )
        if message_id is None:
            self.errorOccurred.emit("Failed to send file")
        self.messageListChanged.emit(self._current_chat_id)
        self.chatListChanged.emit()

    @Slot(str, str)
    def sendReply(self, content: str, reply_to: str) -> None:
        if not self._current_chat_id:
            return
        try:
            content = validate_message_content(content)
            reply_to = validate_uuid(reply_to, "message ID")
        except Exception as e:
            self.errorOccurred.emit(str(e))
            return
        _safe_ensure_future(self._sendReply_async(content, reply_to), "sendReply")

    async def _sendReply_async(self, content: str, reply_to: str) -> None:
        await self._message_ctrl.send_reply(self._current_chat_id, self._current_user_id, content, reply_to)
        self.messageListChanged.emit(self._current_chat_id)

    @Slot(str)
    def deleteMessage(self, message_id: str) -> None:
        deleted = self._message_ctrl.delete_for_everyone(message_id, self._current_user_id)
        if deleted:
            msg = self._message_ctrl.get_by_id(message_id)
            if msg:
                _safe_ensure_future(self._message_ctrl.delete_remote(message_id), "deleteMessage")
                self.messageListChanged.emit(msg.chat_id)

    @Slot(str)
    def deleteForMe(self, message_id: str) -> None:
        msg = self._message_ctrl.get_by_id(message_id)
        if msg:
            self._message_ctrl.delete_for_me(message_id)
            self.messageListChanged.emit(msg.chat_id)

    @Slot(str)
    def toggleStarMessage(self, message_id: str) -> None:
        self._message_ctrl.toggle_star(message_id)
        msg = self._message_ctrl.get_by_id(message_id)
        if msg:
            self.messageListChanged.emit(msg.chat_id)

    @Slot(str, result=str)
    def searchUsers(self, query: str) -> str:
        try:
            query = validate_query(query)
        except Exception:
            return "[]"
        _safe_ensure_future(self._searchUsers_async(query), "searchUsers")
        return "[]"

    async def _searchUsers_async(self, query: str) -> None:
        try:
            results = await self._contact_ctrl.search_users(query)
            self.searchResults.emit(json.dumps(results))
        except Exception as e:
            logger.error("Search users failed: %s", e)
            self.searchResults.emit("[]")

    @Slot(str, result=str)
    def addContact(self, user_id: str) -> str:
        _safe_ensure_future(self._addContact_async(user_id), "addContact")
        return "ok"

    async def _addContact_async(self, user_id: str) -> None:
        await self._contact_ctrl.add_contact(self._current_user_id, user_id)

    @Slot(str)
    def blockUser(self, user_id: str) -> None:
        _safe_ensure_future(self._contact_ctrl.block_user(self._current_user_id, user_id), "blockUser")

    @Slot(str)
    def unblockUser(self, user_id: str) -> None:
        _safe_ensure_future(self._contact_ctrl.unblock_user(self._current_user_id, user_id), "unblockUser")

    # --- Settings Slots ---

    @Slot(str, str)
    def updateProfile(self, display_name: str, about: str) -> None:
        try:
            display_name = validate_display_name(display_name)
        except Exception as e:
            self.errorOccurred.emit(str(e))
            return
        _safe_ensure_future(self._updateProfile_async(display_name, about), "updateProfile")

    async def _updateProfile_async(self, display_name: str, about: str) -> None:
        try:
            await self._settings_ctrl.update_profile(self._current_user_id, display_name, about)
            self.profileUpdated.emit()
        except Exception as e:
            logger.error("Failed to update profile: %s", e)

    @Slot(str)
    def uploadAvatar(self, file_path: str) -> None:
        try:
            file_path = validate_file_path(file_path)
            validate_file_type(file_path, "image")
        except Exception as e:
            self.errorOccurred.emit(str(e))
            return
        _safe_ensure_future(self._uploadAvatar_async(file_path), "uploadAvatar")

    async def _uploadAvatar_async(self, file_path: str) -> None:
        try:
            await self._settings_ctrl.upload_avatar(self._current_user_id, file_path)
            self.profileUpdated.emit()
        except Exception as e:
            logger.error("Avatar upload failed: %s", e)
            self.errorOccurred.emit(f"Failed to upload avatar: {e}")

    # --- Chat Management Slots ---

    @Slot(str, result=bool)
    def toggleMuteChat(self, chat_id: str) -> bool:
        return self._chat_ctrl.toggle_mute(chat_id)

    @Slot(str, result=bool)
    def toggleArchiveChat(self, chat_id: str) -> bool:
        result = self._chat_ctrl.toggle_archive(chat_id)
        self.chatListChanged.emit()
        return result

    @Slot(str)
    def deleteChat(self, chat_id: str) -> None:
        self._chat_ctrl.delete_chat(chat_id)
        _safe_ensure_future(self._chat_ctrl.delete_chat_remote(chat_id), "deleteChat")
        self.chatListChanged.emit()

    @Slot(str)
    def sendTyping(self, chat_id: str) -> None:
        if self._realtime and self._realtime._ws and self._realtime._ws.open:
            try:
                ref = self._realtime._next_ref()
                msg = [ref, f"typing:{chat_id}", "typing", {
                    "user_id": self._current_user_id,
                    "chat_id": chat_id,
                    "is_typing": True,
                }]
                asyncio.ensure_future(self._realtime._ws.send(json.dumps(msg)))
            except Exception as e:
                logger.debug("Failed to send typing: %s", e)

    # --- Internal sync/realtime ---

    def _ensure_token_manager(self) -> None:
        """Create/start the proactive token refresh loop once per session."""
        if self._token_manager is None:
            self._token_manager = TokenManager(self._supabase, self._auth, self._db)
            self._token_manager.on_token_updated(self._on_tokens_updated)
        if not self._token_manager.is_running():
            _safe_ensure_future(self._token_manager.start(), "tokenManager")

    async def _on_tokens_updated(self) -> None:
        """Reconnect Realtime after token rotation so it never dies on expiry."""
        await self._refresh_realtime()

    async def _connect_ipc(self) -> None:
        """Connect to the daemon (if running) for pushes and lifecycle events."""
        if self._ipc is not None:
            return
        ipc = IpcClient()
        ipc.on(IpcMessageType.NEW_MESSAGE, self._on_ipc_new_message)
        ipc.on(IpcMessageType.SYNC_STATE, self._on_ipc_sync_state)
        if await ipc.connect():
            self._ipc = ipc
            try:
                await ipc.send(IpcMessage.gui_opened())
            except Exception:
                pass
            logger.info("IPC link with daemon established")

    async def _on_ipc_new_message(self, message: IpcMessage) -> None:
        """Handle a NEW_MESSAGE push from the daemon."""
        await self._on_new_message({"eventType": "INSERT", "record": message.data})

    async def _on_ipc_sync_state(self, message: IpcMessage) -> None:
        """Daemon reports aggregate state (e.g. unread totals)."""
        try:
            total_unread = int(message.data.get("total_unread", 0))
        except (TypeError, ValueError):
            return
        if total_unread > 0:
            self.chatListChanged.emit()

    async def _sync_data(self) -> None:
        """Sync data from Supabase to local DB after login."""
        try:
            contacts_data = await self._database.select(
                "contacts",
                filters={"user_id": self._current_user_id},
            )
            for c in contacts_data:
                self._contact_repo.add(
                    self._current_user_id,
                    c["contact_id"],
                    c.get("contact_name_override", "Unknown"),
                    None,
                    None,
                )

            summaries = await self._database.select(
                "chat_summaries",
                columns=(
                    "id,is_group,group_name,group_avatar_url,group_admin_id,"
                    "created_at,updated_at,last_message_at,members"
                ),
                order="last_message_at",
                ascending=False,
            )

            for row in summaries:
                chat_id = row["id"]
                is_group = row.get("is_group", False)

                for m in row.get("members") or []:
                    if not is_group and m.get("user_id") == self._current_user_id:
                        continue
                    member = ChatMember(
                        user_id=m["user_id"],
                        display_name=m.get("display_name") or "Unknown",
                        avatar_url=m.get("avatar_url"),
                        role=ChatRole(m.get("role", "member")),
                    )
                    self._chat_repo.insert_member(chat_id, member)

                chat_obj = Chat(
                    id=chat_id,
                    is_group=is_group,
                    group_name=row.get("group_name"),
                    group_avatar_url=row.get("group_avatar_url"),
                    group_admin_id=row.get("group_admin_id"),
                    created_at=to_epoch(row.get("created_at")),
                    updated_at=to_epoch(row.get("updated_at")),
                    last_message_at=to_epoch(row.get("last_message_at")),
                )
                self._chat_repo.insert(chat_obj)

                messages_data = await self._database.select(
                    "messages",
                    columns="id,sender_id,message_type,encrypted_content,created_at,deleted_for_everyone",
                    filters={"chat_id": chat_id},
                    order="created_at",
                    limit=50,
                )
                for msg in messages_data:
                    msg_obj = Message(
                        id=msg["id"],
                        chat_id=chat_id,
                        sender_id=msg.get("sender_id", ""),
                        message_type=MessageType(msg.get("message_type", "text")),
                        encrypted_content=msg.get("encrypted_content", ""),
                        created_at=to_epoch(msg.get("created_at")),
                        deleted_for_everyone=msg.get("deleted_for_everyone", False),
                    )
                    self._message_repo.insert(msg_obj)

            self._refresh_chat_list()
            self.chatListChanged.emit()

        except Exception as e:
            logger.error("Data sync failed: %s", e)

    def _refresh_chat_list(self) -> None:
        chats = self._chat_repo.get_all(include_archived=False)
        chat_dicts = []
        for chat in chats:
            last_msg = self._message_repo.get_last_message(chat.id)
            chat_dicts.append({
                "id": chat.id,
                "display_name": chat.display_name,
                "is_group": chat.is_group,
                "last_message_preview": last_msg.plaintext_content[:100] if last_msg and last_msg.plaintext_content else "",
                "last_message_at": last_msg.created_at if last_msg else 0,
                "unread_count": chat.unread_count,
                "is_muted": chat.is_muted,
                "is_pinned": chat.is_pinned,
                "is_archived": chat.is_archived,
            })
        self._chatListModel.update_chats(chat_dicts)

    async def _setup_realtime(self) -> None:
        if not self._supabase.is_authenticated:
            return
        self._realtime = SupabaseRealtime(
            self._supabase.config.realtime_url,
            self._supabase.config.anon_key,
            self._supabase._access_token or "",
        )
        self._realtime.set_callbacks(
            on_connect=lambda: self.connectionChanged.emit(True),
            on_disconnect=lambda: self.connectionChanged.emit(False),
        )

        await self._realtime.subscribe(
            topic="realtime:public:messages",
            callback=self._on_new_message,
            table="messages",
        )

        await self._realtime.connect()
        if not self._queue_drained:
            self._queue_drained = True
            await self._drain_offline_queue()
        if self._disappearing_task is None:
            self._disappearing_task = asyncio.ensure_future(self._disappearing_messages_loop())

    async def _drain_offline_queue(self) -> None:
        queued = self._offline_queue.dequeue(limit=20)
        if not queued:
            return
        logger.info("Draining %d queued messages", len(queued))
        for msg in queued:
            try:
                await self._database.insert("messages", {
                    "id": msg["message_id"],
                    "chat_id": msg["chat_id"],
                    "sender_id": msg.get("sender_id") or self._current_user_id,
                    "message_type": msg.get("message_type", "text"),
                    "encrypted_content": msg["encrypted_content"],
                    "metadata": json.loads(msg.get("metadata_json") or "{}"),
                    "reply_to": msg.get("reply_to"),
                })
                self._offline_queue.mark_sent(msg["id"])
            except Exception as e:
                logger.warning("Failed to send queued message %s: %s", msg["message_id"], e)
                self._offline_queue.mark_failed(msg["id"])
        self._offline_queue.purge_stale()

    async def _disappearing_messages_loop(self) -> None:
        while self._is_authenticated:
            try:
                deleted = self._message_repo.cleanup_disappeared()
                if deleted > 0:
                    logger.info("Cleaned up %d disappeared messages", deleted)
                    if self._current_chat_id:
                        self.messageListChanged.emit(self._current_chat_id)
            except Exception as e:
                logger.debug("Disappearing messages cleanup error: %s", e)
            try:
                await asyncio.sleep(60)
            except RuntimeError:
                break

    async def _on_new_message(self, payload: dict) -> None:
        if payload.get("eventType") != "INSERT":
            return
        record = payload.get("record", {})
        if record.get("sender_id") == self._current_user_id:
            return

        msg = await self._message_ctrl.handle_incoming(payload, self._current_user_id)
        if msg:
            self.messageReceived.emit(msg.chat_id, msg.sender_id, msg.plaintext_content or "")
            self.messageListChanged.emit(msg.chat_id)
            self.chatListChanged.emit()
