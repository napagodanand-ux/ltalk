"""Contact model for the contacts list."""

from __future__ import annotations

from typing import Any, Optional

from PySide6.QtCore import QAbstractListModel, QModelIndex, Qt


class ContactModel(QAbstractListModel):
    """Qt model for the contacts list.

    Roles:
        UserId, DisplayName, AvatarUrl, About, IsBlocked
    """

    UserId = Qt.ItemDataRole.UserRole + 1
    DisplayName = Qt.ItemDataRole.UserRole + 2
    AvatarUrl = Qt.ItemDataRole.UserRole + 3
    About = Qt.ItemDataRole.UserRole + 4
    IsBlocked = Qt.ItemDataRole.UserRole + 5

    def __init__(self, parent: Any = None) -> None:
        super().__init__(parent)
        self._contacts: list[dict] = []

    def roleNames(self) -> dict[int, bytes]:
        return {
            self.UserId: b"userId",
            self.DisplayName: b"displayName",
            self.AvatarUrl: b"avatarUrl",
            self.About: b"about",
            self.IsBlocked: b"isBlocked",
        }

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:
        if parent.isValid():
            return 0
        return len(self._contacts)

    def data(self, index: QModelIndex, role: int = Qt.ItemDataRole.DisplayRole) -> Any:
        if not index.isValid() or index.row() >= len(self._contacts):
            return None
        contact = self._contacts[index.row()]
        role_map = {
            self.UserId: contact.get("contact_id", ""),
            self.DisplayName: contact.get("display_name", ""),
            self.AvatarUrl: contact.get("avatar_url", ""),
            self.About: contact.get("about", ""),
            self.IsBlocked: contact.get("is_blocked", False),
        }
        return role_map.get(role)

    def update_contacts(self, contacts: list[dict]) -> None:
        self.beginResetModel()
        self._contacts = sorted(contacts, key=lambda c: c.get("display_name", ""))
        self.endResetModel()

    def add_contact(self, contact: dict) -> None:
        self.beginInsertRows(QModelIndex(), len(self._contacts), len(self._contacts))
        self._contacts.append(contact)
        self.endInsertRows()

    def remove_contact(self, user_id: str) -> None:
        for i, contact in enumerate(self._contacts):
            if contact.get("contact_id") == user_id:
                self.beginRemoveRows(QModelIndex(), i, i)
                del self._contacts[i]
                self.endRemoveRows()
                return

    def get_user_id(self, index: int) -> Optional[str]:
        if 0 <= index < len(self._contacts):
            return self._contacts[index].get("contact_id")
        return None
