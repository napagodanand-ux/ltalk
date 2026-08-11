"""Chat list model for the sidebar."""

from __future__ import annotations

import time
from typing import Any, Optional

from PySide6.QtCore import QAbstractListModel, QModelIndex, Qt, Signal, Slot


class ChatListModel(QAbstractListModel):
    """Qt model for the sidebar chat list.

    Roles:
        ChatId, DisplayName, LastMessage, LastMessageTime,
        UnreadCount, IsMuted, IsPinned, IsGroup, AvatarUrl, IsOnline, IsArchived
    """

    ChatId = Qt.ItemDataRole.UserRole + 1
    DisplayName = Qt.ItemDataRole.UserRole + 2
    LastMessage = Qt.ItemDataRole.UserRole + 3
    LastMessageTime = Qt.ItemDataRole.UserRole + 4
    UnreadCount = Qt.ItemDataRole.UserRole + 5
    IsMuted = Qt.ItemDataRole.UserRole + 6
    IsPinned = Qt.ItemDataRole.UserRole + 7
    IsGroup = Qt.ItemDataRole.UserRole + 8
    AvatarUrl = Qt.ItemDataRole.UserRole + 9
    IsOnline = Qt.ItemDataRole.UserRole + 10
    IsArchived = Qt.ItemDataRole.UserRole + 11

    def __init__(self, parent: Any = None) -> None:
        super().__init__(parent)
        self._chats: list[dict] = []
        self._all_chats: list[dict] = []

    def roleNames(self) -> dict[int, bytes]:
        return {
            self.ChatId: b"chatId",
            self.DisplayName: b"displayName",
            self.LastMessage: b"lastMessage",
            self.LastMessageTime: b"lastMessageTime",
            self.UnreadCount: b"unreadCount",
            self.IsMuted: b"isMuted",
            self.IsPinned: b"isPinned",
            self.IsGroup: b"isGroup",
            self.AvatarUrl: b"avatarUrl",
            self.IsOnline: b"isOnline",
            self.IsArchived: b"isArchived",
        }

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:
        if parent.isValid():
            return 0
        return len(self._chats)

    def data(self, index: QModelIndex, role: int = Qt.ItemDataRole.DisplayRole) -> Any:
        if not index.isValid() or index.row() >= len(self._chats):
            return None
        chat = self._chats[index.row()]
        role_map = {
            self.ChatId: chat.get("id", ""),
            self.DisplayName: chat.get("display_name", "Unknown"),
            self.LastMessage: chat.get("last_message_preview", ""),
            self.LastMessageTime: chat.get("last_message_at", 0),
            self.UnreadCount: chat.get("unread_count", 0),
            self.IsMuted: chat.get("is_muted", False),
            self.IsPinned: chat.get("is_pinned", False),
            self.IsGroup: chat.get("is_group", False),
            self.AvatarUrl: chat.get("avatar_url", ""),
            self.IsOnline: chat.get("is_online", False),
            self.IsArchived: chat.get("is_archived", False),
        }
        return role_map.get(role)

    def update_chats(self, chats: list[dict]) -> None:
        """Replace the entire chat list."""
        self.beginResetModel()
        self._all_chats = chats
        self._chats = sorted(
            chats,
            key=lambda c: (c.get("is_pinned", False), c.get("last_message_at", 0)),
            reverse=True,
        )
        self.endResetModel()

    @Slot(str)
    def search(self, query: str) -> None:
        """Filter chats by display name or last message preview."""
        q = query.strip().lower()
        if not q:
            self.update_chats(self._all_chats)
            return
        filtered = [
            c for c in self._all_chats
            if q in (c.get("display_name", "") or "").lower()
            or q in (c.get("last_message_preview", "") or "").lower()
        ]
        sorted_chats = sorted(
            filtered,
            key=lambda c: (c.get("is_pinned", False), c.get("last_message_at", 0)),
            reverse=True,
        )
        self.beginResetModel()
        self._chats = sorted_chats
        self.endResetModel()

    def update_chat(self, chat_id: str, data: dict) -> None:
        """Update a single chat in the list."""
        for i, chat in enumerate(self._chats):
            if chat.get("id") == chat_id:
                self._chats[i].update(data)
                self.dataChanged.emit(
                    self.index(i), self.index(i), list(self.roleNames().keys())
                )
                return

    def add_chat(self, chat: dict) -> None:
        """Add a new chat to the list."""
        self.beginInsertRows(QModelIndex(), 0, 0)
        self._chats.insert(0, chat)
        self.endInsertRows()

    def remove_chat(self, chat_id: str) -> None:
        """Remove a chat from the list."""
        for i, chat in enumerate(self._chats):
            if chat.get("id") == chat_id:
                self.beginRemoveRows(QModelIndex(), i, i)
                del self._chats[i]
                self.endRemoveRows()
                return

    def get_chat_id(self, index: int) -> Optional[str]:
        """Get chat ID at index."""
        if 0 <= index < len(self._chats):
            return self._chats[index].get("id")
        return None
