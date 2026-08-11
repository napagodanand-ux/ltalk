"""IPC protocol for GUI ↔ Daemon communication."""

from .protocol import IpcMessage, IpcMessageType, IpcProtocol

__all__ = [
    "IpcMessage",
    "IpcMessageType",
    "IpcProtocol",
]
