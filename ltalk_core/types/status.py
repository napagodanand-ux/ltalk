"""Status (Stories) domain types."""

from __future__ import annotations

import enum
import time
from dataclasses import dataclass, field
from typing import Optional


class StatusType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"


class StatusPrivacy(str, enum.Enum):
    CONTACTS = "contacts"
    CONTACTS_EXCEPT = "contacts_except"
    ONLY_SHARE_WITH = "only_share_with"


@dataclass
class StatusView:
    status_id: str
    viewer_id: str
    viewed_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "status_id": self.status_id,
            "viewer_id": self.viewer_id,
            "viewed_at": self.viewed_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> StatusView:
        return cls(
            status_id=data["status_id"],
            viewer_id=data["viewer_id"],
            viewed_at=data.get("viewed_at", time.time()),
        )


@dataclass
class Status:
    id: str
    user_id: str
    status_type: StatusType
    encrypted_content: str
    plaintext_content: Optional[str] = None
    background_color: str = "#A52A2A"
    created_at: float = field(default_factory=time.time)
    expires_at: float = field(default_factory=lambda: time.time() + 86400)
    privacy: StatusPrivacy = StatusPrivacy.CONTACTS
    privacy_data_json: str = "[]"
    views: list[StatusView] = field(default_factory=list)

    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at

    @property
    def view_count(self) -> int:
        return len(self.views)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "status_type": self.status_type.value,
            "encrypted_content": self.encrypted_content,
            "plaintext_content": self.plaintext_content,
            "background_color": self.background_color,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "privacy": self.privacy.value,
            "privacy_data_json": self.privacy_data_json,
            "views": [v.to_dict() for v in self.views],
        }

    @classmethod
    def from_dict(cls, data: dict) -> Status:
        views_data = data.get("views", [])
        return cls(
            id=data["id"],
            user_id=data["user_id"],
            status_type=StatusType(data["status_type"]),
            encrypted_content=data["encrypted_content"],
            plaintext_content=data.get("plaintext_content"),
            background_color=data.get("background_color", "#A52A2A"),
            created_at=data.get("created_at", time.time()),
            expires_at=data.get("expires_at", time.time() + 86400),
            privacy=StatusPrivacy(data.get("privacy", "contacts")),
            privacy_data_json=data.get("privacy_data_json", "[]"),
            views=[StatusView.from_dict(v) for v in views_data],
        )
