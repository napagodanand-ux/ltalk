"""Offline message queue processor."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from ltalk_core.db.connection import Database
from ltalk_core.db.queue import OfflineQueue
from ltalk_core.supabase.database import SupabaseDatabase

logger = logging.getLogger(__name__)

RETRY_INTERVAL = 30  # seconds
MAX_RETRIES = 5


class QueueProcessor:
    """Processes offline message queue with retry logic."""

    def __init__(self, db: Database, supabase_client: Any) -> None:
        self._db = db
        self._supabase = supabase_client
        self._queue = OfflineQueue(db)
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the queue processor."""
        self._running = True
        self._task = asyncio.create_task(self._process_loop())
        logger.info("Queue processor started")

    async def stop(self) -> None:
        """Stop the queue processor."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Queue processor stopped")

    async def _process_loop(self) -> None:
        """Periodically process queued messages."""
        while self._running:
            try:
                await self._process_queue()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Queue processing error: %s", e)
            await asyncio.sleep(RETRY_INTERVAL)

    async def _process_queue(self) -> None:
        """Process pending messages in the queue."""
        if not self._supabase or not self._supabase.is_authenticated:
            return

        pending = self._queue.dequeue(limit=20)
        if not pending:
            return

        db = SupabaseDatabase(self._supabase)
        for entry in pending:
            try:
                await db.insert("messages", {
                    "chat_id": entry["chat_id"],
                    "encrypted_content": entry["encrypted_content"],
                    "message_type": entry["message_type"],
                    "metadata": entry.get("metadata_json", "{}"),
                    "reply_to": entry.get("reply_to"),
                })
                self._queue.mark_sent(entry["id"])
                logger.info("Sent queued message %d", entry["id"])
            except (KeyError, ValueError) as e:
                logger.warning("Invalid queued message data %d: %s", entry["id"], e)
                self._queue.mark_failed(entry["id"])
            except Exception as e:
                logger.warning("Failed to send queued message %d: %s", entry["id"], e)
                self._queue.mark_failed(entry["id"])

        # Purge stale messages
        purged = self._queue.purge_stale()
        if purged:
            logger.info("Purged %d stale queued messages", purged)
