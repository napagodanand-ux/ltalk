"""Message CRUD operations."""

from __future__ import annotations

import json
import time
from typing import Optional

from ..types.message import Message, MessageStatus, MessageType
from .connection import Database


class MessageRepository:
    """Handles message persistence in local SQLCipher database."""

    def __init__(self, db: Database) -> None:
        self.db = db

    def insert(self, message: Message) -> None:
        """Insert a new message."""
        self.db.execute(
            """
            INSERT OR REPLACE INTO messages
            (id, chat_id, sender_id, message_type, encrypted_content, plaintext_content,
             metadata_json, reply_to, is_forwarded, is_starred, created_at, edited_at,
             deleted_for_me, deleted_for_everyone, disappearing_until)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                message.id,
                message.chat_id,
                message.sender_id,
                message.message_type.value,
                message.encrypted_content,
                message.plaintext_content,
                message.metadata_json,
                message.reply_to,
                int(message.is_forwarded),
                int(message.is_starred),
                int(message.created_at),
                int(message.edited_at) if message.edited_at else None,
                int(message.deleted_for_me),
                int(message.deleted_for_everyone),
                int(message.disappearing_until) if message.disappearing_until else None,
            ),
        )
        self.db.commit()

    def get_by_id(self, message_id: str) -> Optional[Message]:
        """Get a message by its ID."""
        row = self.db.fetchone(
            "SELECT * FROM messages WHERE id = ?", (message_id,)
        )
        if row is None:
            return None
        return self._row_to_message(row)

    def get_by_chat(
        self, chat_id: str, limit: int = 50, offset: int = 0
    ) -> list[Message]:
        """Get messages for a chat, ordered by creation time descending."""
        rows = self.db.fetchall(
            """
            SELECT * FROM messages
            WHERE chat_id = ? AND deleted_for_me = 0
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (chat_id, limit, offset),
        )
        return [self._row_to_message(row) for row in rows]

    def get_last_message(self, chat_id: str) -> Optional[Message]:
        """Get the most recent message in a chat."""
        row = self.db.fetchone(
            """
            SELECT * FROM messages
            WHERE chat_id = ? AND deleted_for_me = 0
            ORDER BY created_at DESC LIMIT 1
            """,
            (chat_id,),
        )
        if row is None:
            return None
        return self._row_to_message(row)

    def search(self, query: str, chat_id: Optional[str] = None) -> list[Message]:
        """Search messages by content."""
        pattern = f"%{query}%"
        if chat_id:
            rows = self.db.fetchall(
                """
                SELECT * FROM messages
                WHERE plaintext_content LIKE ? AND chat_id = ? AND deleted_for_me = 0
                ORDER BY created_at DESC LIMIT 100
                """,
                (pattern, chat_id),
            )
        else:
            rows = self.db.fetchall(
                """
                SELECT * FROM messages
                WHERE plaintext_content LIKE ? AND deleted_for_me = 0
                ORDER BY created_at DESC LIMIT 100
                """,
                (pattern,),
            )
        return [self._row_to_message(row) for row in rows]

    def update_status(self, message_id: str, user_id: str, status: MessageStatus) -> None:
        """Update message delivery status."""
        self.db.execute(
            "UPDATE message_status SET status = ?, updated_at = ? WHERE message_id = ? AND user_id = ?",
            (status.value, int(time.time()), message_id, user_id),
        )
        self.db.commit()

    def upsert_status(
        self, message_id: str, chat_id: str, user_id: str, status: MessageStatus
    ) -> None:
        """Insert or update message status."""
        self.db.execute(
            """
            INSERT OR REPLACE INTO message_status (message_id, chat_id, user_id, status, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (message_id, chat_id, user_id, status.value, int(time.time())),
        )
        self.db.commit()

    def get_status(self, message_id: str, user_id: str) -> Optional[MessageStatus]:
        """Get the status of a message for a specific user."""
        row = self.db.fetchone(
            "SELECT status FROM message_status WHERE message_id = ? AND user_id = ?",
            (message_id, user_id),
        )
        if row is None:
            return None
        return MessageStatus(row["status"])

    def mark_deleted_for_me(self, message_id: str) -> None:
        """Mark a message as deleted for the current user only."""
        self.db.execute(
            "UPDATE messages SET deleted_for_me = 1 WHERE id = ?",
            (message_id,),
        )
        self.db.commit()

    def mark_deleted_for_everyone(self, message_id: str) -> None:
        """Mark a message as deleted for all participants."""
        self.db.execute(
            "UPDATE messages SET deleted_for_everyone = 1, plaintext_content = NULL WHERE id = ?",
            (message_id,),
        )
        self.db.commit()

    def edit_message(self, message_id: str, new_content: str) -> None:
        """Edit a message's content."""
        self.db.execute(
            "UPDATE messages SET plaintext_content = ?, edited_at = ? WHERE id = ?",
            (new_content, int(time.time()), message_id),
        )
        self.db.commit()

    def toggle_star(self, message_id: str) -> None:
        """Toggle star status on a message."""
        self.db.execute(
            "UPDATE messages SET is_starred = NOT is_starred WHERE id = ?",
            (message_id,),
        )
        self.db.commit()

    def get_starred(self) -> list[Message]:
        """Get all starred messages."""
        rows = self.db.fetchall(
            "SELECT * FROM messages WHERE is_starred = 1 AND deleted_for_me = 0 ORDER BY created_at DESC"
        )
        return [self._row_to_message(row) for row in rows]

    def cleanup_disappeared(self) -> int:
        """Remove messages that have passed their disappearing timer."""
        now = int(time.time())
        cursor = self.db.execute(
            "DELETE FROM messages WHERE disappearing_until IS NOT NULL AND disappearing_until < ?",
            (now,),
        )
        self.db.commit()
        return cursor.rowcount

    def _row_to_message(self, row) -> Message:
        """Convert a database row to a Message object."""
        return Message(
            id=row["id"],
            chat_id=row["chat_id"],
            sender_id=row["sender_id"],
            message_type=MessageType(row["message_type"]),
            encrypted_content=row["encrypted_content"],
            plaintext_content=row["plaintext_content"],
            metadata_json=row["metadata_json"] or "{}",
            reply_to=row["reply_to"],
            is_forwarded=bool(row["is_forwarded"]),
            is_starred=bool(row["is_starred"]),
            created_at=row["created_at"],
            edited_at=row["edited_at"],
            deleted_for_me=bool(row["deleted_for_me"]),
            deleted_for_everyone=bool(row["deleted_for_everyone"]),
            disappearing_until=row["disappearing_until"],
        )
