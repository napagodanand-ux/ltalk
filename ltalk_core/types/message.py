"""Message domain types."""

from __future__ import annotations

import enum
import time
from dataclasses import dataclass, field
from typing import Optional


class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    VOICE = "voice"
    DOCUMENT = "document"
    LOCATION = "location"
    CONTACT = "contact"
    STICKER = "sticker"
    POLL = "poll"
    SYSTEM = "system"


class MessageStatus(str, enum.Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


@dataclass
class MessageReaction:
    user_id: str
    emoji: str
    created_at: float = field(default_factory=time.time)


@dataclass
class Message:
    id: str
    chat_id: str
    sender_id: str
    message_type: MessageType
    encrypted_content: str
    plaintext_content: Optional[str] = None
    metadata_json: str = "{}"
    reply_to: Optional[str] = None
    is_forwarded: bool = False
    is_starred: bool = False
    created_at: float = field(default_factory=time.time)
    edited_at: Optional[float] = None
    deleted_for_me: bool = False
    deleted_for_everyone: bool = False
    disappearing_until: Optional[float] = None
    status: MessageStatus = MessageStatus.SENT

    @property
    def is_deleted(self) -> bool:
        return self.deleted_for_everyone

    @property
    def is_edited(self) -> bool:
        return self.edited_at is not None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "chat_id": self.chat_id,
            "sender_id": self.sender_id,
            "message_type": self.message_type.value,
            "encrypted_content": self.encrypted_content,
            "plaintext_content": self.plaintext_content,
            "metadata_json": self.metadata_json,
            "reply_to": self.reply_to,
            "is_forwarded": self.is_forwarded,
            "is_starred": self.is_starred,
            "created_at": self.created_at,
            "edited_at": self.edited_at,
            "deleted_for_me": self.deleted_for_me,
            "deleted_for_everyone": self.deleted_for_everyone,
            "disappearing_until": self.disappearing_until,
            "status": self.status.value,
        }

    @classmethod
    def from_dict(cls, data: dict) -> Message:
        return cls(
            id=data["id"],
            chat_id=data["chat_id"],
            sender_id=data["sender_id"],
            message_type=MessageType(data["message_type"]),
            encrypted_content=data["encrypted_content"],
            plaintext_content=data.get("plaintext_content"),
            metadata_json=data.get("metadata_json", "{}"),
            reply_to=data.get("reply_to"),
            is_forwarded=data.get("is_forwarded", False),
            is_starred=data.get("is_starred", False),
            created_at=data.get("created_at", time.time()),
            edited_at=data.get("edited_at"),
            deleted_for_me=data.get("deleted_for_me", False),
            deleted_for_everyone=data.get("deleted_for_everyone", False),
            disappearing_until=data.get("disappearing_until"),
            status=MessageStatus(data.get("status", "sent")),
        )
