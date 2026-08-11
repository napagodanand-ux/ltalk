"""Realtime WebSocket listener for background message reception."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Optional

from ltalk_core.supabase.realtime import SupabaseRealtime

logger = logging.getLogger(__name__)


class RealtimeListener:
    """Maintains a persistent Supabase Realtime connection in the daemon."""

    def __init__(
        self,
        supabase_client: Any,
        on_message: Callable[[dict], Any],
    ) -> None:
        self._supabase = supabase_client
        self._on_message = on_message
        self._realtime: Optional[SupabaseRealtime] = None
        self._listening = False

    async def connect(self) -> None:
        """Establish the Realtime connection."""
        if not self._supabase.is_authenticated:
            logger.warning("Cannot connect Realtime: not authenticated")
            return

        self._realtime = SupabaseRealtime(
            self._supabase.config.realtime_url,
            self._supabase.config.anon_key,
            self._supabase._access_token or "",
        )

        # Subscribe to messages table
        await self._realtime.subscribe(
            topic="realtime:public:messages",
            callback=self._handle_event,
            table="messages",
        )

        # Subscribe to calls table
        await self._realtime.subscribe(
            topic="realtime:public:calls",
            callback=self._handle_call_event,
            table="calls",
        )

        # Subscribe to status changes
        await self._realtime.subscribe(
            topic="realtime:public:message_status",
            callback=self._handle_status_event,
            table="message_status",
        )

        await self._realtime.connect()
        self._listening = True
        logger.info("Realtime listener connected")

    async def disconnect(self) -> None:
        """Disconnect the Realtime listener."""
        if self._realtime:
            await self._realtime.disconnect()
            self._listening = False
            logger.info("Realtime listener disconnected")

    async def _handle_event(self, payload: dict) -> None:
        """Handle incoming message events."""
        if self._on_message:
            result = self._on_message(payload)
            if asyncio.iscoroutine(result):
                await result

    async def _handle_call_event(self, payload: dict) -> None:
        """Handle incoming call events."""
        logger.info("Call event: %s", payload)

    async def _handle_status_event(self, payload: dict) -> None:
        """Handle message status updates."""
        logger.debug("Status update: %s", payload)

    @property
    def is_connected(self) -> bool:
        return self._listening and self._realtime is not None
