"""Presence heartbeat for online/offline status."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = 60  # seconds


class PresenceHeartbeat:
    """Sends periodic presence heartbeats to Supabase."""

    def __init__(self, supabase_client: Any) -> None:
        self._supabase = supabase_client
        self._running = False
        self._task: asyncio.Task | None = None
        self._online = False
        self._cached_user_id: str | None = None

    async def start(self) -> None:
        """Start the heartbeat."""
        self._running = True
        self._online = True
        await self._set_online()
        self._task = asyncio.create_task(self._heartbeat_loop())
        logger.info("Presence heartbeat started")

    async def stop(self) -> None:
        """Stop the heartbeat and set offline."""
        self._running = False
        self._online = False
        await self._set_offline()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Presence heartbeat stopped")

    async def set_online(self) -> None:
        """Set status to online."""
        self._online = True
        await self._set_online()

    async def set_offline(self) -> None:
        """Set status to offline."""
        self._online = False
        await self._set_offline()

    async def _heartbeat_loop(self) -> None:
        """Send periodic heartbeats."""
        while self._running:
            try:
                if self._online:
                    await self._set_online()
            except Exception as e:
                logger.error("Heartbeat error: %s", e)
            await asyncio.sleep(HEARTBEAT_INTERVAL)

    async def _get_user_id(self) -> str | None:
        """Get current user ID from local DB (cached after first fetch)."""
        if self._cached_user_id:
            return self._cached_user_id
        try:
            from ltalk_core.db.connection import Database
            db = Database()
            db.connect()
            row = db.fetchone("SELECT id FROM local_user LIMIT 1")
            db.close()
            if row:
                self._cached_user_id = row["id"]
                return self._cached_user_id
        except Exception:
            pass
        return None

    async def _set_online(self) -> None:
        """Update presence to online."""
        if not self._supabase or not self._supabase.is_authenticated:
            return
        try:
            user_id = await self._get_user_id()
            if not user_id:
                return
            from ltalk_core.supabase.database import SupabaseDatabase
            db = SupabaseDatabase(self._supabase)
            await db.update("profiles", {
                "online": True,
                "last_seen": "now()",
            }, {"user_id": f"eq.{user_id}"})
        except Exception as e:
            logger.debug("Failed to set online: %s", e)

    async def _set_offline(self) -> None:
        """Update presence to offline."""
        if not self._supabase or not self._supabase.is_authenticated:
            return
        try:
            user_id = await self._get_user_id()
            if not user_id:
                return
            from ltalk_core.supabase.database import SupabaseDatabase
            db = SupabaseDatabase(self._supabase)
            await db.update("profiles", {
                "online": False,
                "last_seen": "now()",
            }, {"user_id": f"eq.{user_id}"})
        except Exception as e:
            logger.debug("Failed to set offline: %s", e)
