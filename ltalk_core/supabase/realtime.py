"""Custom Supabase Realtime WebSocket client using Phoenix Channels protocol."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Callable, Optional

import websockets
from websockets.exceptions import ConnectionClosed

from ltalk_core.exceptions import NetworkError

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = 30
RECONNECT_DELAY = 1.0
MAX_RECONNECT_DELAY = 30.0


class RealtimeChannel:
    """Represents a single Realtime channel subscription."""

    def __init__(
        self,
        topic: str,
        callback: Callable[[dict], Any],
        event: str = "postgres_changes",
        schema: str = "public",
        table: Optional[str] = None,
        filter: Optional[str] = None,
    ) -> None:
        self.topic = topic
        self.callback = callback
        self.event = event
        self.schema = schema
        self.table = table
        self.filter = filter
        self.joined = False
        self.join_ref: Optional[str] = None


class SupabaseRealtime:
    """Persistent WebSocket connection to Supabase Realtime using Phoenix Channels."""

    def __init__(self, realtime_url: str, api_key: str, access_token: str) -> None:
        self.realtime_url = realtime_url
        self.api_key = api_key
        self.access_token = access_token
        self._ws: Optional[Any] = None
        self._channels: dict[str, RealtimeChannel] = {}
        self._running = False
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._receive_task: Optional[asyncio.Task] = None
        self._ref_counter = 0
        self._pending_acks: dict[str, asyncio.Event] = {}
        self._on_connect: Optional[Callable[[], Any]] = None
        self._on_disconnect: Optional[Callable[[], Any]] = None

    def set_callbacks(
        self,
        on_connect: Optional[Callable[[], Any]] = None,
        on_disconnect: Optional[Callable[[], Any]] = None,
    ) -> None:
        self._on_connect = on_connect
        self._on_disconnect = on_disconnect

    def _next_ref(self) -> str:
        self._ref_counter += 1
        return str(self._ref_counter)

    async def connect(self) -> None:
        """Establish the WebSocket connection."""
        if self._running:
            return
        self._running = True
        asyncio.create_task(self._connect_loop())

    async def _connect_loop(self) -> None:
        """Reconnection loop."""
        delay = RECONNECT_DELAY
        while self._running:
            try:
                await self._do_connect()
                delay = RECONNECT_DELAY
                await self._receive_loop()
            except asyncio.CancelledError:
                break
            except (ConnectionClosed, OSError, asyncio.TimeoutError) as e:
                logger.warning("Realtime connection lost: %s", e)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Realtime unexpected error: %s", e)
            finally:
                if self._on_disconnect:
                    try:
                        result = self._on_disconnect()
                        if asyncio.iscoroutine(result):
                            await result
                    except Exception:
                        pass
                if self._ws:
                    try:
                        await self._ws.close()
                    except (ConnectionClosed, OSError):
                        pass
                    self._ws = None
                for ch in self._channels.values():
                    ch.joined = False

            if not self._running:
                break
            logger.info("Reconnecting in %.1fs...", delay)
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                break
            delay = min(delay * 2, MAX_RECONNECT_DELAY)

    async def _do_connect(self) -> None:
        """Perform the actual WebSocket connection and auth."""
        connect_url = (
            f"{self.realtime_url}"
            f"?apikey={self.api_key}"
            f"&vsn=1.0.0"
        )
        extra_headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.access_token}",
        }
        self._ws = await asyncio.wait_for(
            websockets.connect(connect_url, additional_headers=extra_headers),
            timeout=10,
        )
        logger.info("Realtime connected")
        if self._on_connect:
            result = self._on_connect()
            if asyncio.iscoroutine(result):
                await result
        # Rejoin all channels
        for channel in self._channels.values():
            await self._join_channel(channel)

    async def _receive_loop(self) -> None:
        """Process incoming WebSocket messages."""
        assert self._ws is not None
        async for raw in self._ws:
            try:
                msg = json.loads(raw)
                await self._handle_message(msg)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from realtime")

    async def _handle_message(self, msg: dict) -> None:
        """Route an incoming Phoenix message."""
        msg_type = msg.get("event")
        topic = msg.get("topic", "")
        ref = msg.get("ref")

        if msg_type == "phx_reply":
            if ref and ref in self._pending_acks:
                self._pending_acks[ref].set()
            return

        if msg_type == "postgres_changes":
            payload = msg.get("payload", {})
            if topic in self._channels:
                channel = self._channels[topic]
                result = channel.callback(payload)
                if asyncio.iscoroutine(result):
                    await result
            return

        if msg_type == "presence_diff":
            if topic in self._channels:
                channel = self._channels[topic]
                result = channel.callback(msg.get("payload", {}))
                if asyncio.iscoroutine(result):
                    await result
            return

    async def _join_channel(self, channel: RealtimeChannel) -> None:
        """Send a join message for a channel."""
        assert self._ws is not None
        ref = self._next_ref()
        channel.join_ref = ref

        join_payload: dict[str, Any] = {
            "config": {
                "broadcast": {"self": False},
                "presence": {"key": ""},
                "postgres_changes": [
                    {
                        "event": channel.event,
                        "schema": channel.schema,
                        "table": channel.table,
                        **(({"filter": channel.filter}) if channel.filter else {}),
                    }
                ],
            },
            "topic": channel.topic,
        }

        msg = [ref, channel.topic, "phx_join", join_payload]
        await self._ws.send(json.dumps(msg))

        ack_event = asyncio.Event()
        self._pending_acks[ref] = ack_event
        try:
            await asyncio.wait_for(ack_event.wait(), timeout=5)
            channel.joined = True
            logger.info("Joined channel: %s", channel.topic)
        except asyncio.TimeoutError:
            logger.warning("Timeout joining channel: %s", channel.topic)
        finally:
            self._pending_acks.pop(ref, None)

    async def subscribe(
        self,
        topic: str,
        callback: Callable[[dict], Any],
        event: str = "postgres_changes",
        schema: str = "public",
        table: Optional[str] = None,
        filter: Optional[str] = None,
    ) -> None:
        """Subscribe to a Realtime channel."""
        channel = RealtimeChannel(
            topic=topic,
            callback=callback,
            event=event,
            schema=schema,
            table=table,
            filter=filter,
        )
        self._channels[topic] = channel
        if self._ws and self._ws.open:
            await self._join_channel(channel)

    async def unsubscribe(self, topic: str) -> None:
        """Unsubscribe from a channel."""
        if topic not in self._channels:
            return
        channel = self._channels.pop(topic)
        if self._ws and self._ws.open and channel.joined:
            ref = self._next_ref()
            msg = [ref, topic, "leave", {}]
            await self._ws.send(json.dumps(msg))

    def stop(self) -> None:
        """Stop the realtime connection (sync)."""
        self._running = False
        if self._ws:
            try:
                # Close the underlying transport directly (close() is async)
                if hasattr(self._ws, 'transport') and self._ws.transport:
                    self._ws.transport.close()
                else:
                    self._ws = None
            except (OSError, ConnectionError):
                pass
            self._ws = None
        for ch in self._channels.values():
            ch.joined = False

    async def disconnect(self) -> None:
        """Stop the realtime connection (async)."""
        self._running = False
        if self._ws:
            try:
                await self._ws.close()
            except (ConnectionClosed, OSError):
                pass
            self._ws = None
        for ch in self._channels.values():
            ch.joined = False
