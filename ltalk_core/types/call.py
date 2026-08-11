"""Call domain types."""

from __future__ import annotations

import enum
import time
from dataclasses import dataclass, field
from typing import Optional


class CallType(str, enum.Enum):
    VOICE = "voice"
    VIDEO = "video"


class CallStatus(str, enum.Enum):
    INITIATED = "initiated"
    RINGING = "ringing"
    ANSWERED = "answered"
    ENDED = "ended"
    MISSED = "missed"
    DECLINED = "declined"


@dataclass
class CallParticipant:
    user_id: str
    display_name: str
    avatar_url: Optional[str] = None
    joined_at: float = field(default_factory=time.time)
    left_at: Optional[float] = None

    @property
    def duration_seconds(self) -> float:
        if self.left_at:
            return self.left_at - self.joined_at
        return time.time() - self.joined_at

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "joined_at": self.joined_at,
            "left_at": self.left_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> CallParticipant:
        return cls(
            user_id=data["user_id"],
            display_name=data["display_name"],
            avatar_url=data.get("avatar_url"),
            joined_at=data.get("joined_at", time.time()),
            left_at=data.get("left_at"),
        )


@dataclass
class Call:
    id: str
    chat_id: str
    caller_id: str
    call_type: CallType
    status: CallStatus = CallStatus.INITIATED
    started_at: Optional[float] = None
    ended_at: Optional[float] = None
    duration_seconds: Optional[int] = None
    participants: list[CallParticipant] = field(default_factory=list)

    @property
    def is_active(self) -> bool:
        return self.status in (CallStatus.RINGING, CallStatus.ANSWERED)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "chat_id": self.chat_id,
            "caller_id": self.caller_id,
            "call_type": self.call_type.value,
            "status": self.status.value,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "duration_seconds": self.duration_seconds,
            "participants": [p.to_dict() for p in self.participants],
        }

    @classmethod
    def from_dict(cls, data: dict) -> Call:
        participants_data = data.get("participants", [])
        return cls(
            id=data["id"],
            chat_id=data["chat_id"],
            caller_id=data["caller_id"],
            call_type=CallType(data["call_type"]),
            status=CallStatus(data.get("status", "initiated")),
            started_at=data.get("started_at"),
            ended_at=data.get("ended_at"),
            duration_seconds=data.get("duration_seconds"),
            participants=[CallParticipant.from_dict(p) for p in participants_data],
        )
