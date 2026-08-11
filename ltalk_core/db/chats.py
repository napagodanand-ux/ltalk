"""Chat CRUD operations."""

from __future__ import annotations

import time
from typing import Optional

from ..types.chat import Chat, ChatMember, ChatRole
from .connection import Database


class ChatRepository:
    """Handles chat persistence in local SQLCipher database."""

    def __init__(self, db: Database) -> None:
        self.db = db

    def insert(self, chat: Chat) -> None:
        """Insert or update a chat."""
        self.db.execute(
            """
            INSERT OR REPLACE INTO chats
            (id, is_group, group_name, group_avatar_url, group_admin_id,
             last_message_preview, last_message_at, unread_count, is_muted,
             is_archived, is_pinned, disappearing_duration, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chat.id,
                int(chat.is_group),
                chat.group_name,
                chat.group_avatar_url,
                chat.group_admin_id,
                chat.last_message_preview,
                int(chat.last_message_at) if chat.last_message_at else None,
                chat.unread_count,
                int(chat.is_muted),
                int(chat.is_archived),
                int(chat.is_pinned),
                chat.disappearing_duration,
                int(chat.created_at),
                int(chat.updated_at),
            ),
        )
        self.db.commit()

    def insert_member(self, chat_id: str, member: ChatMember) -> None:
        """Insert or update a chat member."""
        self.db.execute(
            """
            INSERT OR REPLACE INTO chat_members (chat_id, user_id, display_name, avatar_url, role, joined_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (chat_id, member.user_id, member.display_name, member.avatar_url, member.role.value, int(member.joined_at)),
        )
        self.db.commit()

    def get_by_id(self, chat_id: str) -> Optional[Chat]:
        """Get a chat by its ID with members."""
        row = self.db.fetchone("SELECT * FROM chats WHERE id = ?", (chat_id,))
        if row is None:
            return None
        chat = self._row_to_chat(row)
        chat.members = self._get_members(chat_id)
        return chat

    def get_all(self, include_archived: bool = False) -> list[Chat]:
        """Get all chats, ordered by last message time."""
        if include_archived:
            rows = self.db.fetchall(
                "SELECT * FROM chats ORDER BY is_pinned DESC, last_message_at DESC"
            )
        else:
            rows = self.db.fetchall(
                "SELECT * FROM chats WHERE is_archived = 0 ORDER BY is_pinned DESC, last_message_at DESC"
            )
        chats = []
        for row in rows:
            chat = self._row_to_chat(row)
            chat.members = self._get_members(chat.id)
            chats.append(chat)
        return chats

    def get_direct_chat(self, other_user_id: str) -> Optional[Chat]:
        """Get the direct chat with a specific user."""
        row = self.db.fetchone(
            """
            SELECT c.* FROM chats c
            JOIN chat_members cm ON c.id = cm.chat_id
            WHERE c.is_group = 0 AND cm.user_id = ?
            """,
            (other_user_id,),
        )
        if row is None:
            return None
        chat = self._row_to_chat(row)
        chat.members = self._get_members(chat.id)
        return chat

    def search(self, query: str) -> list[Chat]:
        """Search chats by name."""
        pattern = f"%{query}%"
        rows = self.db.fetchall(
            """
            SELECT * FROM chats
            WHERE (group_name LIKE ? OR last_message_preview LIKE ?)
            AND is_archived = 0
            ORDER BY last_message_at DESC
            """,
            (pattern, pattern),
        )
        chats = []
        for row in rows:
            chat = self._row_to_chat(row)
            chat.members = self._get_members(chat.id)
            chats.append(chat)
        return chats

    def update_last_message(
        self, chat_id: str, preview: str, timestamp: float
    ) -> None:
        """Update the last message preview and timestamp."""
        self.db.execute(
            "UPDATE chats SET last_message_preview = ?, last_message_at = ?, updated_at = ? WHERE id = ?",
            (preview, int(timestamp), int(time.time()), chat_id),
        )
        self.db.commit()

    def increment_unread(self, chat_id: str) -> None:
        """Increment unread count for a chat."""
        self.db.execute(
            "UPDATE chats SET unread_count = unread_count + 1 WHERE id = ?",
            (chat_id,),
        )
        self.db.commit()

    def clear_unread(self, chat_id: str) -> None:
        """Reset unread count to zero."""
        self.db.execute(
            "UPDATE chats SET unread_count = 0 WHERE id = ?", (chat_id,)
        )
        self.db.commit()

    def toggle_mute(self, chat_id: str) -> bool:
        """Toggle mute status. Returns new state."""
        row = self.db.fetchone(
            "SELECT is_muted FROM chats WHERE id = ?", (chat_id,)
        )
        if row is None:
            return False
        new_state = 0 if row["is_muted"] else 1
        self.db.execute(
            "UPDATE chats SET is_muted = ? WHERE id = ?", (new_state, chat_id)
        )
        self.db.commit()
        return bool(new_state)

    def toggle_archive(self, chat_id: str) -> bool:
        """Toggle archive status. Returns new state."""
        row = self.db.fetchone(
            "SELECT is_archived FROM chats WHERE id = ?", (chat_id,)
        )
        if row is None:
            return False
        new_state = 0 if row["is_archived"] else 1
        self.db.execute(
            "UPDATE chats SET is_archived = ? WHERE id = ?",
            (new_state, chat_id),
        )
        self.db.commit()
        return bool(new_state)

    def toggle_pin(self, chat_id: str) -> bool:
        """Toggle pin status. Returns new state."""
        row = self.db.fetchone(
            "SELECT is_pinned FROM chats WHERE id = ?", (chat_id,)
        )
        if row is None:
            return False
        new_state = 0 if row["is_pinned"] else 1
        self.db.execute(
            "UPDATE chats SET is_pinned = ? WHERE id = ?", (new_state, chat_id)
        )
        self.db.commit()
        return bool(new_state)

    def delete(self, chat_id: str) -> None:
        """Delete a chat and all its messages."""
        self.db.execute("DELETE FROM chat_members WHERE chat_id = ?", (chat_id,))
        self.db.execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))
        self.db.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
        self.db.commit()

    def get_total_unread(self) -> int:
        """Get total unread message count across all chats."""
        row = self.db.fetchone(
            "SELECT SUM(unread_count) as total FROM chats WHERE is_muted = 0"
        )
        if row is None or row["total"] is None:
            return 0
        return row["total"]

    def _get_members(self, chat_id: str) -> list[ChatMember]:
        """Get all members of a chat."""
        rows = self.db.fetchall(
            "SELECT * FROM chat_members WHERE chat_id = ?", (chat_id,)
        )
        return [
            ChatMember(
                user_id=row["user_id"],
                display_name=row["display_name"],
                avatar_url=row["avatar_url"],
                role=ChatRole(row["role"]),
                joined_at=row["joined_at"],
            )
            for row in rows
        ]

    def _row_to_chat(self, row) -> Chat:
        """Convert a database row to a Chat object."""
        return Chat(
            id=row["id"],
            is_group=bool(row["is_group"]),
            group_name=row["group_name"],
            group_avatar_url=row["group_avatar_url"],
            group_admin_id=row["group_admin_id"],
            last_message_preview=row["last_message_preview"],
            last_message_at=row["last_message_at"],
            unread_count=row["unread_count"],
            is_muted=bool(row["is_muted"]),
            is_archived=bool(row["is_archived"]),
            is_pinned=bool(row["is_pinned"]),
            disappearing_duration=row["disappearing_duration"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
