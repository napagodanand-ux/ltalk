"""Message controller."""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import TYPE_CHECKING

from ltalk_core.logging import get_context_filter
from ltalk_core.types.message import Message, MessageStatus, MessageType

if TYPE_CHECKING:
    from ltalk_core.crypto.encrypt import MessageEncryptor
    from ltalk_core.db.chats import ChatRepository
    from ltalk_core.db.messages import MessageRepository
    from ltalk_core.db.queue import OfflineQueue
    from ltalk_core.supabase.client import SupabaseClient
    from ltalk_core.supabase.database import SupabaseDatabase
    from ltalk_core.supabase.storage import SupabaseStorage

logger = logging.getLogger(__name__)


class MessageController:
    """Handles message send/receive/delete operations."""

    def __init__(
        self,
        db: object,
        supabase: SupabaseClient,
        database: SupabaseDatabase,
        storage: SupabaseStorage,
        message_repo: MessageRepository,
        chat_repo: ChatRepository,
        offline_queue: OfflineQueue,
        encryptor: MessageEncryptor,
    ) -> None:
        self._db = db
        self._supabase = supabase
        self._database = database
        self._storage = storage
        self._message_repo = message_repo
        self._chat_repo = chat_repo
        self._offline_queue = offline_queue
        self._encryptor = encryptor

    def get_messages(self, chat_id: str, limit: int = 100) -> list[Message]:
        """Get messages for a chat."""
        return self._message_repo.get_by_chat(chat_id, limit=limit)

    def get_by_id(self, message_id: str) -> Message | None:
        """Get a message by ID."""
        return self._message_repo.get_by_id(message_id)

    def get_last_message(self, chat_id: str) -> Message | None:
        """Get the last message in a chat."""
        return self._message_repo.get_last_message(chat_id)

    async def send_text(
        self, chat_id: str, user_id: str, content: str
    ) -> str:
        """Send a text message. Returns message_id."""
        message_id = str(uuid.uuid4())
        encrypted = await self._encryptor.encrypt_message(chat_id, content, self._supabase)

        ctx = get_context_filter()
        ctx.set_context(user_id=user_id, chat_id=chat_id)
        logger.info("Sending text message")

        msg = Message(
            id=message_id,
            chat_id=chat_id,
            sender_id=user_id,
            message_type=MessageType.TEXT,
            encrypted_content=encrypted,
            plaintext_content=content,
            created_at=time.time(),
        )
        self._message_repo.insert(msg)
        self._chat_repo.update_last_message(chat_id, content[:100], time.time())

        try:
            await self._database.insert("messages", {
                "id": message_id,
                "chat_id": chat_id,
                "sender_id": user_id,
                "message_type": "text",
                "encrypted_content": encrypted,
            })
        except Exception as e:
            logger.warning("Failed to send message, queued: %s", e)
            self._offline_queue.enqueue(
                chat_id=chat_id,
                encrypted_content=encrypted,
                message_type="text",
                message_id=message_id,
                sender_id=user_id,
            )

        return message_id

    async def send_reply(
        self, chat_id: str, user_id: str, content: str, reply_to: str
    ) -> str:
        """Send a reply. Returns message_id."""
        message_id = str(uuid.uuid4())
        encrypted = await self._encryptor.encrypt_message(chat_id, content, self._supabase)

        msg = Message(
            id=message_id,
            chat_id=chat_id,
            sender_id=user_id,
            message_type=MessageType.TEXT,
            encrypted_content=encrypted,
            plaintext_content=content,
            reply_to=reply_to,
            created_at=time.time(),
        )
        self._message_repo.insert(msg)
        self._chat_repo.update_last_message(chat_id, content[:100], time.time())

        try:
            await self._database.insert("messages", {
                "id": message_id,
                "chat_id": chat_id,
                "sender_id": user_id,
                "message_type": "text",
                "encrypted_content": encrypted,
                "reply_to": reply_to,
            })
        except Exception as e:
            logger.warning("Failed to send reply, queued: %s", e)
            self._offline_queue.enqueue(
                chat_id=chat_id,
                encrypted_content=encrypted,
                message_type="text",
                message_id=message_id,
                sender_id=user_id,
                metadata_json="{}",
                reply_to=reply_to,
            )

        return message_id

    async def send_file(
        self, chat_id: str, user_id: str, file_path: str, file_type: str
    ) -> str | None:
        """Send a file attachment. Returns message_id or None on failure."""
        import os
        message_id = str(uuid.uuid4())
        file_name = os.path.basename(file_path)

        try:
            with open(file_path, "rb") as f:
                file_data = f.read()

            bucket = "chat-files"
            storage_path = f"{chat_id}/{message_id}/{file_name}"

            content_type = "application/octet-stream"
            if file_type == "image":
                content_type = "image/png"
            elif file_type == "document":
                content_type = "application/pdf"

            await self._storage.upload_file(bucket, storage_path, file_data, content_type)
            file_url = await self._storage.create_signed_url(bucket, storage_path, expires_in=3600)

            msg_type = MessageType.IMAGE if file_type == "image" else MessageType.DOCUMENT
            content = f"[{file_type.upper()}:{file_name}]"
            encrypted = await self._encryptor.encrypt_message(chat_id, content, self._supabase)
            metadata = {
                "file_name": file_name,
                "file_url": file_url,
                "mime_type": content_type,
            }

            msg = Message(
                id=message_id,
                chat_id=chat_id,
                sender_id=user_id,
                message_type=msg_type,
                encrypted_content=encrypted,
                plaintext_content=file_url,
                metadata_json=json.dumps(metadata),
                created_at=time.time(),
            )
            self._message_repo.insert(msg)
            self._chat_repo.update_last_message(chat_id, f"[{file_type}]", time.time())

            try:
                await self._database.insert("messages", {
                    "id": message_id,
                    "chat_id": chat_id,
                    "sender_id": user_id,
                    "message_type": msg_type.value,
                    "encrypted_content": encrypted,
                    "metadata": metadata,
                })
            except Exception as e:
                logger.warning("Remote send failed, queuing: %s", e)
                self._offline_queue.enqueue(
                    chat_id=chat_id,
                    encrypted_content=encrypted,
                    message_type=msg_type.value,
                    message_id=message_id,
                    sender_id=user_id,
                    metadata_json=json.dumps(metadata),
                )

            return message_id

        except Exception as e:
            logger.error("File send failed: %s", e)
            return None

    def delete_for_everyone(self, message_id: str, user_id: str) -> bool:
        """Delete a message for everyone. Returns True if deleted."""
        msg = self._message_repo.get_by_id(message_id)
        if msg and msg.sender_id == user_id:
            self._message_repo.mark_deleted_for_everyone(message_id)
            return True
        return False

    async def delete_remote(self, message_id: str) -> None:
        """Delete a message on Supabase."""
        try:
            await self._database.update("messages", {"deleted_for_everyone": True}, {"id": message_id})
        except Exception as e:
            logger.warning("Failed to delete message remotely: %s", e)

    def delete_for_me(self, message_id: str) -> None:
        """Delete a message for the current user only."""
        self._message_repo.mark_deleted_for_me(message_id)

    async def mark_read(self, chat_id: str, user_id: str) -> None:
        """Mark all messages in a chat as read."""
        messages = self._message_repo.get_by_chat(chat_id, limit=1000)
        for msg in messages:
            if msg.sender_id != user_id:
                self._message_repo.upsert_status(msg.id, chat_id, user_id, MessageStatus.READ)
                try:
                    await self._database.upsert("message_status", {
                        "message_id": msg.id,
                        "chat_id": chat_id,
                        "user_id": user_id,
                        "status": "read",
                    })
                except Exception as e:
                    logger.debug("Failed to sync read status: %s", e)

    async def handle_incoming(self, payload: dict, current_user_id: str) -> Message | None:
        """Process an incoming realtime message. Returns the Message or None."""
        if payload.get("eventType") != "INSERT":
            return None
        record = payload.get("record", {})
        if record.get("sender_id") == current_user_id:
            return None

        chat_id = record.get("chat_id")
        message_id = record.get("id")
        sender_id = record.get("sender_id")
        encrypted_content = record.get("encrypted_content", "")

        if not message_id or not chat_id:
            return None

        # Dedup: the GUI may receive the same message via its own
        # Realtime subscription and via the daemon's IPC broadcast.
        if self._message_repo.get_by_id(message_id):
            logger.debug("Ignoring duplicate incoming message %s", message_id)
            return None

        ctx = get_context_filter()
        ctx.set_context(user_id=current_user_id, chat_id=chat_id)
        logger.info("Incoming message from %s", sender_id)

        try:
            plaintext = await self._encryptor.decrypt_message(sender_id, encrypted_content)
        except Exception as e:
            logger.debug("Decryption failed: %s", e)
            plaintext = "[Encrypted message]"

        msg = Message(
            id=message_id,
            chat_id=chat_id,
            sender_id=sender_id,
            message_type=MessageType(record.get("message_type", "text")),
            encrypted_content=encrypted_content,
            plaintext_content=plaintext,
            created_at=time.time(),
        )
        self._message_repo.insert(msg)
        self._chat_repo.update_last_message(chat_id, plaintext[:100], time.time())
        self._chat_repo.increment_unread(chat_id)

        self._message_repo.upsert_status(message_id, chat_id, current_user_id, MessageStatus.DELIVERED)
        try:
            await self._database.insert("message_status", {
                "message_id": message_id,
                "chat_id": chat_id,
                "user_id": current_user_id,
                "status": "delivered",
            })
        except Exception as e:
            logger.debug("Failed to mark message delivered: %s", e)

        return msg

    def cleanup_disappeared(self) -> int:
        """Remove disappeared messages. Returns count deleted."""
        return self._message_repo.cleanup_disappeared()

    def search(self, query: str, chat_id: str | None = None) -> list[Message]:
        """Search messages."""
        return self._message_repo.search(query, chat_id)

    def toggle_star(self, message_id: str) -> None:
        """Toggle star on a message."""
        self._message_repo.toggle_star(message_id)

    def get_starred(self) -> list[Message]:
        """Get all starred messages."""
        return self._message_repo.get_starred()
