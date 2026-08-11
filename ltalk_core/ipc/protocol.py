"""IPC protocol for GUI <-> Daemon communication over Unix domain sockets."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class IpcMessageType(str, Enum):
    # GUI -> Daemon
    GUI_OPENED = "gui_opened"
    GUI_CLOSED = "gui_closed"
    SEND_MESSAGE = "send_message"
    UPDATE_PRESENCE = "update_presence"
    SHUTDOWN_DAEMON = "shutdown_daemon"
    MARK_READ = "mark_read"
    TYPING_START = "typing_start"
    TYPING_STOP = "typing_stop"

    # Daemon -> GUI
    NEW_MESSAGE = "new_message"
    MESSAGE_STATUS = "message_status"
    INCOMING_CALL = "incoming_call"
    TYPING_INDICATOR = "typing_indicator"
    PRESENCE_UPDATE = "presence_update"
    SYNC_STATE = "sync_state"
    ERROR = "error"
    AUTH_TOKEN_REFRESH = "auth_token_refresh"


@dataclass
class IpcMessage:
    type: IpcMessageType
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    request_id: Optional[str] = None

    def serialize(self) -> bytes:
        payload = {
            "type": self.type.value,
            "data": self.data,
            "timestamp": self.timestamp,
        }
        if self.request_id:
            payload["request_id"] = self.request_id
        return (json.dumps(payload) + "\n").encode("utf-8")

    @classmethod
    def deserialize(cls, raw: bytes) -> IpcMessage:
        text = raw.decode("utf-8").strip()
        if not text:
            raise ValueError("Empty IPC message")
        payload = json.loads(text)
        return cls(
            type=IpcMessageType(payload["type"]),
            data=payload.get("data", {}),
            timestamp=payload.get("timestamp", time.time()),
            request_id=payload.get("request_id"),
        )

    @classmethod
    def gui_opened(cls) -> IpcMessage:
        return cls(type=IpcMessageType.GUI_OPENED)

    @classmethod
    def gui_closed(cls) -> IpcMessage:
        return cls(type=IpcMessageType.GUI_CLOSED)

    @classmethod
    def new_message(cls, message_data: dict) -> IpcMessage:
        return cls(type=IpcMessageType.NEW_MESSAGE, data=message_data)

    @classmethod
    def message_status(cls, message_id: str, chat_id: str, user_id: str, status: str) -> IpcMessage:
        return cls(
            type=IpcMessageType.MESSAGE_STATUS,
            data={
                "message_id": message_id,
                "chat_id": chat_id,
                "user_id": user_id,
                "status": status,
            },
        )

    @classmethod
    def send_message(cls, chat_id: str, encrypted_content: str, message_type: str, **kwargs) -> IpcMessage:
        data = {
            "chat_id": chat_id,
            "encrypted_content": encrypted_content,
            "message_type": message_type,
        }
        data.update(kwargs)
        return cls(type=IpcMessageType.SEND_MESSAGE, data=data)

    @classmethod
    def typing_indicator(cls, chat_id: str, user_id: str, is_typing: bool) -> IpcMessage:
        return cls(
            type=IpcMessageType.TYPING_INDICATOR,
            data={"chat_id": chat_id, "user_id": user_id, "is_typing": is_typing},
        )

    @classmethod
    def presence_update(cls, user_id: str, status: str, last_seen: float) -> IpcMessage:
        return cls(
            type=IpcMessageType.PRESENCE_UPDATE,
            data={"user_id": user_id, "status": status, "last_seen": last_seen},
        )

    @classmethod
    def sync_state(cls, state: dict) -> IpcMessage:
        return cls(type=IpcMessageType.SYNC_STATE, data=state)

    @classmethod
    def error(cls, message: str, request_id: Optional[str] = None) -> IpcMessage:
        return cls(
            type=IpcMessageType.ERROR,
            data={"message": message},
            request_id=request_id,
        )

    @classmethod
    def auth_token_refresh(cls, jwt: str, refresh_token: str, expires_at: float) -> IpcMessage:
        return cls(
            type=IpcMessageType.AUTH_TOKEN_REFRESH,
            data={"jwt": jwt, "refresh_token": refresh_token, "jwt_expires_at": expires_at},
        )


class IpcProtocol:
    """Manages IPC message framing over a stream socket."""

    def __init__(self) -> None:
        self._buffer = b""

    def feed(self, data: bytes) -> list[IpcMessage]:
        """Feed raw bytes from socket, return complete messages."""
        self._buffer += data
        messages: list[IpcMessage] = []
        while b"\n" in self._buffer:
            line, self._buffer = self._buffer.split(b"\n", 1)
            if line.strip():
                messages.append(IpcMessage.deserialize(line))
        return messages

    def reset(self) -> None:
        self._buffer = b""
