"""Status (Stories) model for the status carousel."""

from __future__ import annotations

from typing import Any, Optional

from PySide6.QtCore import QAbstractListModel, QModelIndex, Qt


class StatusModel(QAbstractListModel):
    """Qt model for status stories.

    Roles:
        StatusId, UserId, DisplayName, StatusType, Content, BackgroundColor,
        CreatedAt, ExpiresAt, ViewCount, IsViewed
    """

    StatusId = Qt.ItemDataRole.UserRole + 1
    UserId = Qt.ItemDataRole.UserRole + 2
    DisplayName = Qt.ItemDataRole.UserRole + 3
    StatusType = Qt.ItemDataRole.UserRole + 4
    Content = Qt.ItemDataRole.UserRole + 5
    BackgroundColor = Qt.ItemDataRole.UserRole + 6
    CreatedAt = Qt.ItemDataRole.UserRole + 7
    ExpiresAt = Qt.ItemDataRole.UserRole + 8
    ViewCount = Qt.ItemDataRole.UserRole + 9
    IsViewed = Qt.ItemDataRole.UserRole + 10

    def __init__(self, parent: Any = None) -> None:
        super().__init__(parent)
        self._statuses: list[dict] = []

    def roleNames(self) -> dict[int, bytes]:
        return {
            self.StatusId: b"statusId",
            self.UserId: b"userId",
            self.DisplayName: b"displayName",
            self.StatusType: b"statusType",
            self.Content: b"content",
            self.BackgroundColor: b"backgroundColor",
            self.CreatedAt: b"createdAt",
            self.ExpiresAt: b"expiresAt",
            self.ViewCount: b"viewCount",
            self.IsViewed: b"isViewed",
        }

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:
        if parent.isValid():
            return 0
        return len(self._statuses)

    def data(self, index: QModelIndex, role: int = Qt.ItemDataRole.DisplayRole) -> Any:
        if not index.isValid() or index.row() >= len(self._statuses):
            return None
        status = self._statuses[index.row()]
        role_map = {
            self.StatusId: status.get("id", ""),
            self.UserId: status.get("user_id", ""),
            self.DisplayName: status.get("display_name", "Unknown"),
            self.StatusType: status.get("status_type", "text"),
            self.Content: status.get("plaintext_content", ""),
            self.BackgroundColor: status.get("background_color", "#A52A2A"),
            self.CreatedAt: status.get("created_at", 0),
            self.ExpiresAt: status.get("expires_at", 0),
            self.ViewCount: status.get("view_count", 0),
            self.IsViewed: status.get("is_viewed", False),
        }
        return role_map.get(role)

    def update_statuses(self, statuses: list[dict]) -> None:
        self.beginResetModel()
        self._statuses = sorted(statuses, key=lambda s: s.get("created_at", 0), reverse=True)
        self.endResetModel()

    def add_status(self, status: dict) -> None:
        self.beginInsertRows(QModelIndex(), 0, 0)
        self._statuses.insert(0, status)
        self.endInsertRows()

    def get_status_id(self, index: int) -> Optional[str]:
        if 0 <= index < len(self._statuses):
            return self._statuses[index].get("id")
        return None
