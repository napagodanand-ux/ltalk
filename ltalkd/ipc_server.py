"""Unix socket IPC server for GUI <-> Daemon communication."""

from __future__ import annotations

import asyncio
import logging
import os
import socket
import struct
from pathlib import Path
from typing import Any, Optional

from ltalk_core.ipc.protocol import IpcMessage, IpcMessageType, IpcProtocol

logger = logging.getLogger(__name__)

SOCK_PATH = f"/tmp/ltalk-{os.getuid()}.sock"


def _get_peer_uid(writer: asyncio.StreamWriter) -> Optional[int]:
    """Resolve the peer process uid via SO_PEERCRED (Linux)."""
    sock = writer.get_extra_info("socket")
    if sock is None:
        return None
    try:
        cred = sock.getsockopt(
            socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i")
        )
        _pid, uid, _gid = struct.unpack("3i", cred)
        return int(uid)
    except (OSError, ValueError):
        return None


class IpcServer:
    """Unix domain socket server for IPC with the GUI process."""

    def __init__(self, daemon: Any) -> None:
        self._daemon = daemon
        self._server: Optional[asyncio.AbstractServer] = None
        self._clients: dict[asyncio.StreamWriter, IpcProtocol] = {}

    async def start(self) -> None:
        """Start listening for GUI connections."""
        # Remove stale socket
        sock_path = Path(SOCK_PATH)
        if sock_path.exists():
            sock_path.unlink()

        self._server = await asyncio.start_unix_server(
            self._handle_client,
            path=SOCK_PATH,
        )
        os.chmod(SOCK_PATH, 0o600)
        logger.info("IPC server listening on %s", SOCK_PATH)

    async def stop(self) -> None:
        """Stop the IPC server."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        # Close all client connections
        for writer in list(self._clients.keys()):
            writer.close()
        self._clients.clear()
        # Remove socket file
        sock_path = Path(SOCK_PATH)
        if sock_path.exists():
            sock_path.unlink()
        logger.info("IPC server stopped")

    async def _handle_client(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Handle a new GUI client connection."""
        # Peer auth: refuse connections from other processes (fail closed).
        peer_uid = _get_peer_uid(writer)
        if peer_uid != os.getuid():
            logger.warning(
                "Rejected IPC connection from uid=%s (expected uid=%s)",
                peer_uid,
                os.getuid(),
            )
            writer.close()
            return

        protocol = IpcProtocol()
        self._clients[writer] = protocol
        logger.info("GUI client connected (uid=%s)", peer_uid)

        try:
            while True:
                data = await reader.read(4096)
                if not data:
                    break

                try:
                    messages = protocol.feed(data)
                except ValueError as e:
                    logger.warning("Bad IPC frame from client: %s", e)
                    break
                for msg in messages:
                    await self._process_message(msg, writer)
        except (ConnectionResetError, asyncio.CancelledError, OSError):
            pass
        finally:
            self._clients.pop(writer, None)
            writer.close()
            logger.info("GUI client disconnected")

    async def _process_message(
        self, msg: IpcMessage, writer: asyncio.StreamWriter
    ) -> None:
        """Process an IPC message from the GUI."""
        if msg.type == IpcMessageType.GUI_OPENED:
            logger.info("GUI opened")
            # Send sync state
            if self._daemon._chat_repo:
                total_unread = self._daemon._chat_repo.get_total_unread()
                sync_msg = IpcMessage.sync_state({"total_unread": total_unread})
                writer.write(sync_msg.serialize())
                await writer.drain()

        elif msg.type == IpcMessageType.GUI_CLOSED:
            logger.info("GUI closed, daemon taking over")

        elif msg.type == IpcMessageType.SEND_MESSAGE:
            # Forward message to Supabase
            await self._handle_send_message(msg)

        elif msg.type == IpcMessageType.UPDATE_PRESENCE:
            await self._handle_presence(msg)

        elif msg.type == IpcMessageType.MARK_READ:
            await self._handle_mark_read(msg)

        elif msg.type == IpcMessageType.TYPING_START:
            await self._handle_typing(msg, writer, True)

        elif msg.type == IpcMessageType.TYPING_STOP:
            await self._handle_typing(msg, writer, False)

        elif msg.type == IpcMessageType.SHUTDOWN_DAEMON:
            logger.info("Shutdown requested from GUI")
            await self._daemon.stop()

    async def _handle_send_message(self, msg: IpcMessage) -> None:
        """Send a message via Supabase."""
        data = msg.data
        try:
            if self._daemon._supabase and self._daemon._supabase.is_authenticated:
                from ltalk_core.supabase.database import SupabaseDatabase
                db = SupabaseDatabase(self._daemon._supabase)
                await db.insert("messages", {
                    "id": data.get("id", ""),
                    "chat_id": data["chat_id"],
                    "sender_id": data.get("sender_id", ""),
                    "message_type": data.get("message_type", "text"),
                    "encrypted_content": data["encrypted_content"],
                    "reply_to": data.get("reply_to"),
                })
        except (KeyError, ValueError) as e:
            logger.error("Invalid message data: %s", e)
        except Exception as e:
            logger.error("Failed to send message: %s", e)

    async def _handle_presence(self, msg: IpcMessage) -> None:
        """Update presence status."""
        data = msg.data
        try:
            if self._daemon._supabase and self._daemon._supabase.is_authenticated:
                from ltalk_core.supabase.database import SupabaseDatabase
                db = SupabaseDatabase(self._daemon._supabase)
                await db.update("profiles", {
                    "online": data.get("status") == "online",
                }, {"id": data.get("user_id", "")})
        except Exception as e:
            logger.error("Failed to update presence: %s", e)

    async def _handle_mark_read(self, msg: IpcMessage) -> None:
        """Mark messages as read."""
        data = msg.data
        chat_id = data.get("chat_id", "")
        if self._daemon._db:
            self._daemon._db.execute(
                "UPDATE chats SET unread_count = 0 WHERE id = ?", (chat_id,)
            )
            self._daemon._db.commit()

    async def _handle_typing(self, msg: IpcMessage, original_writer: asyncio.StreamWriter, is_typing: bool) -> None:
        """Forward typing indicators to other connected GUI clients."""
        data = msg.data
        typing_msg = IpcMessage.typing_indicator(
            chat_id=data.get("chat_id", ""),
            user_id=data.get("user_id", ""),
            is_typing=is_typing,
        )
        payload = typing_msg.serialize()
        for writer in list(self._clients.keys()):
            if writer is original_writer:
                continue
            try:
                writer.write(payload)
                await writer.drain()
            except (OSError, ConnectionError):
                self._clients.pop(writer, None)

    async def broadcast_to_gui(self, message: IpcMessage) -> None:
        """Send a message to all connected GUI clients."""
        data = message.serialize()
        for writer in list(self._clients.keys()):
            try:
                writer.write(data)
                await writer.drain()
            except (OSError, ConnectionError):
                self._clients.pop(writer, None)
