"""Offline message queue operations."""

from __future__ import annotations

import time
from typing import Optional

from .connection import Database


class OfflineQueue:
    """Manages messages queued for sending when offline."""

    def __init__(self, db: Database) -> None:
        self.db = db

    def enqueue(
        self,
        chat_id: str,
        encrypted_content: str,
        message_type: str,
        message_id: str,
        sender_id: str,
        metadata_json: str = "{}",
        reply_to: Optional[str] = None,
    ) -> int:
        """Add a message to the offline queue. Returns the queue entry ID."""
        cursor = self.db.execute(
            """
            INSERT INTO offline_queue
            (chat_id, encrypted_content, message_type, message_id, sender_id,
             metadata_json, reply_to, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chat_id,
                encrypted_content,
                message_type,
                message_id,
                sender_id,
                metadata_json,
                reply_to,
                int(time.time()),
            ),
        )
        self.db.commit()
        return cursor.lastrowid

    def dequeue(self, limit: int = 10) -> list[dict]:
        """Get queued messages ready for retry."""
        rows = self.db.fetchall(
            """
            SELECT * FROM offline_queue
            WHERE retry_count < 5
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (limit,),
        )
        return [dict(row) for row in rows]

    def mark_sent(self, queue_id: int) -> None:
        """Remove a message from the queue after successful send."""
        self.db.execute("DELETE FROM offline_queue WHERE id = ?", (queue_id,))
        self.db.commit()

    def mark_failed(self, queue_id: int) -> None:
        """Increment retry count for a failed message."""
        self.db.execute(
            """
            UPDATE offline_queue
            SET retry_count = retry_count + 1, last_retry_at = ?
            WHERE id = ?
            """,
            (int(time.time()), queue_id),
        )
        self.db.commit()

    def purge_stale(self, max_age_seconds: int = 86400 * 7) -> int:
        """Remove messages older than max_age that have been retried."""
        cutoff = int(time.time()) - max_age_seconds
        cursor = self.db.execute(
            "DELETE FROM offline_queue WHERE created_at < ? AND retry_count >= 3",
            (cutoff,),
        )
        self.db.commit()
        return cursor.rowcount

    def get_count(self) -> int:
        """Get number of queued messages."""
        row = self.db.fetchone("SELECT COUNT(*) as c FROM offline_queue")
        return row["c"] if row else 0

    def clear(self) -> None:
        """Clear all queued messages."""
        self.db.execute("DELETE FROM offline_queue")
        self.db.commit()
