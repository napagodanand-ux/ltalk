"""Chat domain types."""

from __future__ import annotations

import enum
import time
from dataclasses import dataclass, field
from typing import Optional


class ChatType(str, enum.Enum):
    DIRECT = "direct"
    GROUP = "group"


class ChatRole(str, enum.Enum):
    ADMIN = "admin"
    MEMBER = "member"


@dataclass
class ChatMember:
    user_id: str
    display_name: str
    avatar_url: Optional[str] = None
    role: ChatRole = ChatRole.MEMBER
    joined_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "role": self.role.value,
            "joined_at": self.joined_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> ChatMember:
        return cls(
            user_id=data["user_id"],
            display_name=data["display_name"],
            avatar_url=data.get("avatar_url"),
            role=ChatRole(data.get("role", "member")),
            joined_at=data.get("joined_at", time.time()),
        )


@dataclass
class Chat:
    id: str
    is_group: bool = False
    group_name: Optional[str] = None
    group_avatar_url: Optional[str] = None
    group_admin_id: Optional[str] = None
    last_message_preview: Optional[str] = None
    last_message_at: Optional[float] = None
    unread_count: int = 0
    is_muted: bool = False
    is_archived: bool = False
    is_pinned: bool = False
    disappearing_duration: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    members: list[ChatMember] = field(default_factory=list)

    @property
    def chat_type(self) -> ChatType:
        return ChatType.GROUP if self.is_group else ChatType.DIRECT

    @property
    def display_name(self) -> str:
        if self.is_group and self.group_name:
            return self.group_name
        if self.members:
            return self.members[0].display_name
        return "Unknown"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "is_group": self.is_group,
            "group_name": self.group_name,
            "group_avatar_url": self.group_avatar_url,
            "group_admin_id": self.group_admin_id,
            "last_message_preview": self.last_message_preview,
            "last_message_at": self.last_message_at,
            "unread_count": self.unread_count,
            "is_muted": self.is_muted,
            "is_archived": self.is_archived,
            "is_pinned": self.is_pinned,
            "disappearing_duration": self.disappearing_duration,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "members": [m.to_dict() for m in self.members],
        }

    @classmethod
    def from_dict(cls, data: dict) -> Chat:
        members_data = data.get("members", [])
        return cls(
            id=data["id"],
            is_group=data.get("is_group", False),
            group_name=data.get("group_name"),
            group_avatar_url=data.get("group_avatar_url"),
            group_admin_id=data.get("group_admin_id"),
            last_message_preview=data.get("last_message_preview"),
            last_message_at=data.get("last_message_at"),
            unread_count=data.get("unread_count", 0),
            is_muted=data.get("is_muted", False),
            is_archived=data.get("is_archived", False),
            is_pinned=data.get("is_pinned", False),
            disappearing_duration=data.get("disappearing_duration"),
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time()),
            members=[ChatMember.from_dict(m) for m in members_data],
        )
