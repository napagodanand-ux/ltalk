"""Message list model for chat messages."""

from __future__ import annotations

from typing import Any, Optional

from PySide6.QtCore import QAbstractListModel, QModelIndex, Qt, Signal


class MessageListModel(QAbstractListModel):
    """Qt model for messages in a chat view.

    Roles:
        MessageId, SenderId, Content, MessageType, Timestamp,
        IsSent, Status, ReplyTo, IsForwarded, IsEdited, IsDeleted
    """

    MessageId = Qt.ItemDataRole.UserRole + 1
    SenderId = Qt.ItemDataRole.UserRole + 2
    Content = Qt.ItemDataRole.UserRole + 3
    MessageType = Qt.ItemDataRole.UserRole + 4
    Timestamp = Qt.ItemDataRole.UserRole + 5
    IsSent = Qt.ItemDataRole.UserRole + 6
    Status = Qt.ItemDataRole.UserRole + 7
    ReplyTo = Qt.ItemDataRole.UserRole + 8
    IsForwarded = Qt.ItemDataRole.UserRole + 9
    IsEdited = Qt.ItemDataRole.UserRole + 10
    IsDeleted = Qt.ItemDataRole.UserRole + 11
    SenderName = Qt.ItemDataRole.UserRole + 12

    def __init__(self, parent: Any = None) -> None:
        super().__init__(parent)
        self._messages: list[dict] = []
        self._current_user_id: str = ""

    def set_current_user(self, user_id: str) -> None:
        self._current_user_id = user_id

    def roleNames(self) -> dict[int, bytes]:
        return {
            self.MessageId: b"messageId",
            self.SenderId: b"senderId",
            self.Content: b"content",
            self.MessageType: b"messageType",
            self.Timestamp: b"timestamp",
            self.IsSent: b"isSent",
            self.Status: b"status",
            self.ReplyTo: b"replyTo",
            self.IsForwarded: b"isForwarded",
            self.IsEdited: b"isEdited",
            self.IsDeleted: b"isDeleted",
            self.SenderName: b"senderName",
        }

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:
        if parent.isValid():
            return 0
        return len(self._messages)

    def data(self, index: QModelIndex, role: int = Qt.ItemDataRole.DisplayRole) -> Any:
        if not index.isValid() or index.row() >= len(self._messages):
            return None
        msg = self._messages[index.row()]
        role_map = {
            self.MessageId: msg.get("id", ""),
            self.SenderId: msg.get("sender_id", ""),
            self.Content: msg.get("plaintext_content", ""),
            self.MessageType: msg.get("message_type", "text"),
            self.Timestamp: msg.get("created_at", 0),
            self.IsSent: msg.get("sender_id", "") == self._current_user_id,
            self.Status: msg.get("status", "sent"),
            self.ReplyTo: msg.get("reply_to"),
            self.IsForwarded: msg.get("is_forwarded", False),
            self.IsEdited: msg.get("edited_at") is not None,
            self.IsDeleted: msg.get("deleted_for_everyone", False),
            self.SenderName: msg.get("sender_name", ""),
        }
        return role_map.get(role)

    def update_messages(self, messages: list[dict]) -> None:
        """Replace all messages for the current chat."""
        self.beginResetModel()
        self._messages = sorted(messages, key=lambda m: m.get("created_at", 0))
        self.endResetModel()

    def add_message(self, message: dict) -> None:
        """Add a new message to the end of the list."""
        # Check for duplicates
        msg_id = message.get("id")
        for existing in self._messages:
            if existing.get("id") == msg_id:
                return
        self.beginInsertRows(QModelIndex(), len(self._messages), len(self._messages))
        self._messages.append(message)
        self.endInsertRows()

    def update_message_status(self, message_id: str, status: str) -> None:
        """Update the delivery status of a message."""
        for i, msg in enumerate(self._messages):
            if msg.get("id") == message_id:
                self._messages[i]["status"] = status
                self.dataChanged.emit(self.index(i), self.index(i), [self.Status])
                return

    def get_message(self, index: int) -> Optional[dict]:
        """Get message at index."""
        if 0 <= index < len(self._messages):
            return self._messages[index]
        return None

    @property
    def last_message(self) -> Optional[dict]:
        return self._messages[-1] if self._messages else None
