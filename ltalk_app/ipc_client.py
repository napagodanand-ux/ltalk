"""IPC client — connects to ltalkd daemon via Unix domain socket."""

from __future__ import annotations

import asyncio
import logging
import os
import socket
from pathlib import Path
from typing import Any, Callable, Optional

from ltalk_core.exceptions import IPCError
from ltalk_core.ipc.protocol import IpcMessage, IpcMessageType, IpcProtocol

logger = logging.getLogger(__name__)

SOCK_PATH = f"/tmp/ltalk-{os.getuid()}.sock"


class IpcClient:
    """Unix socket client for communicating with ltalkd daemon."""

    def __init__(self) -> None:
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._protocol = IpcProtocol()
        self._running = False
        self._handlers: dict[IpcMessageType, Callable] = {}
        self._connected = False

    def on(self, message_type: IpcMessageType, handler: Callable) -> None:
        """Register a handler for a message type."""
        self._handlers[message_type] = handler

    async def connect(self) -> bool:
        """Connect to the daemon socket."""
        sock_path = Path(SOCK_PATH)
        if not sock_path.exists():
            logger.warning("Daemon socket not found at %s", SOCK_PATH)
            return False
        try:
            reader, writer = await asyncio.open_unix_connection(SOCK_PATH)
            self._reader = reader
            self._writer = writer
            self._running = True
            self._connected = True
            asyncio.create_task(self._receive_loop())
            logger.info("Connected to ltalkd")
            return True
        except (OSError, FileNotFoundError, ConnectionRefusedError) as e:
            logger.warning("Failed to connect to daemon: %s", e)
            return False

    async def disconnect(self) -> None:
        """Disconnect from the daemon."""
        self._running = False
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except (OSError, ConnectionError):
                pass
        self._connected = False

    async def send(self, message: IpcMessage) -> None:
        """Send an IPC message to the daemon."""
        if not self._writer or not self._connected:
            logger.warning("Not connected to daemon")
            return
        try:
            self._writer.write(message.serialize())
            await self._writer.drain()
        except (OSError, ConnectionError) as e:
            logger.error("Failed to send IPC message: %s", e)
            self._connected = False

    async def _receive_loop(self) -> None:
        """Listen for messages from the daemon."""
        assert self._reader is not None
        while self._running:
            try:
                data = await self._reader.read(4096)
                if not data:
                    break
                messages = self._protocol.feed(data)
                for msg in messages:
                    await self._handle_message(msg)
            except asyncio.CancelledError:
                break
            except (OSError, ConnectionError) as e:
                logger.error("IPC receive error: %s", e)
                break
        self._connected = False

    async def _handle_message(self, message: IpcMessage) -> None:
        """Route a received message to its handler."""
        handler = self._handlers.get(message.type)
        if handler:
            try:
                result = handler(message)
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.error("Handler error for %s: %s", message.type, e)
                raise IPCError(f"Handler failed for {message.type}: {e}") from e
        else:
            logger.debug("Unhandled IPC message type: %s", message.type)

    @property
    def is_connected(self) -> bool:
        return self._connected
