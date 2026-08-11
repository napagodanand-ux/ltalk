"""User domain types."""

from __future__ import annotations

import enum
import time
from dataclasses import dataclass, field
from typing import Optional


class OnlineStatus(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    LAST_SEEN = "last_seen"


@dataclass
class Presence:
    status: OnlineStatus = OnlineStatus.OFFLINE
    last_seen: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "status": self.status.value,
            "last_seen": self.last_seen,
        }

    @classmethod
    def from_dict(cls, data: dict) -> Presence:
        return cls(
            status=OnlineStatus(data.get("status", "offline")),
            last_seen=data.get("last_seen", time.time()),
        )


@dataclass
class Profile:
    id: str
    display_name: str
    about: str = ""
    avatar_url: Optional[str] = None
    last_seen: float = field(default_factory=time.time)
    online: bool = False
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "display_name": self.display_name,
            "about": self.about,
            "avatar_url": self.avatar_url,
            "last_seen": self.last_seen,
            "online": self.online,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> Profile:
        return cls(
            id=data["id"],
            display_name=data["display_name"],
            about=data.get("about", ""),
            avatar_url=data.get("avatar_url"),
            last_seen=data.get("last_seen", time.time()),
            online=data.get("online", False),
            created_at=data.get("created_at", time.time()),
        )


@dataclass
class User:
    id: str
    email: str
    display_name: str
    about: str = ""
    avatar_url: Optional[str] = None
    jwt: str = ""
    refresh_token: str = ""
    jwt_expires_at: float = 0
    identity_key_private: Optional[bytes] = None
    identity_key_public: Optional[bytes] = None
    created_at: float = field(default_factory=time.time)
    presence: Presence = field(default_factory=Presence)

    @property
    def is_jwt_expired(self) -> bool:
        return time.time() > self.jwt_expires_at

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "display_name": self.display_name,
            "about": self.about,
            "avatar_url": self.avatar_url,
            "jwt": self.jwt,
            "refresh_token": self.refresh_token,
            "jwt_expires_at": self.jwt_expires_at,
            "created_at": self.created_at,
            "presence": self.presence.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> User:
        presence_data = data.get("presence", {})
        return cls(
            id=data["id"],
            email=data["email"],
            display_name=data["display_name"],
            about=data.get("about", ""),
            avatar_url=data.get("avatar_url"),
            jwt=data.get("jwt", ""),
            refresh_token=data.get("refresh_token", ""),
            jwt_expires_at=data.get("jwt_expires_at", 0),
            created_at=data.get("created_at", time.time()),
            presence=Presence.from_dict(presence_data) if presence_data else Presence(),
        )
