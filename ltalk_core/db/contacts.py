"""Contact CRUD operations."""

from __future__ import annotations

import time
from typing import Optional

from ..types.user import Profile
from .connection import Database


class ContactRepository:
    """Handles contact persistence in local SQLCipher database."""

    def __init__(self, db: Database) -> None:
        self.db = db

    def add(self, user_id: str, contact_id: str, display_name: str,
            avatar_url: Optional[str] = None, about: Optional[str] = None) -> None:
        """Add a contact."""
        self.db.execute(
            """
            INSERT OR REPLACE INTO contacts (user_id, contact_id, display_name, avatar_url, about, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, contact_id, display_name, avatar_url, about or "", int(time.time())),
        )
        self.db.commit()

    def remove(self, user_id: str, contact_id: str) -> None:
        """Remove a contact."""
        self.db.execute(
            "DELETE FROM contacts WHERE user_id = ? AND contact_id = ?",
            (user_id, contact_id),
        )
        self.db.commit()

    def get(self, user_id: str, contact_id: str) -> Optional[dict]:
        """Get a specific contact."""
        row = self.db.fetchone(
            "SELECT * FROM contacts WHERE user_id = ? AND contact_id = ?",
            (user_id, contact_id),
        )
        if row is None:
            return None
        return dict(row)

    def get_all(self, user_id: str) -> list[dict]:
        """Get all contacts for a user."""
        rows = self.db.fetchall(
            "SELECT * FROM contacts WHERE user_id = ? AND is_blocked = 0 ORDER BY display_name",
            (user_id,),
        )
        return [dict(row) for row in rows]

    def search(self, user_id: str, query: str) -> list[dict]:
        """Search contacts by name."""
        pattern = f"%{query}%"
        rows = self.db.fetchall(
            "SELECT * FROM contacts WHERE user_id = ? AND display_name LIKE ? AND is_blocked = 0",
            (user_id, pattern),
        )
        return [dict(row) for row in rows]

    def block(self, user_id: str, contact_id: str) -> None:
        """Block a contact."""
        self.db.execute(
            "UPDATE contacts SET is_blocked = 1 WHERE user_id = ? AND contact_id = ?",
            (user_id, contact_id),
        )
        self.db.commit()

    def unblock(self, user_id: str, contact_id: str) -> None:
        """Unblock a contact."""
        self.db.execute(
            "UPDATE contacts SET is_blocked = 0 WHERE user_id = ? AND contact_id = ?",
            (user_id, contact_id),
        )
        self.db.commit()

    def is_blocked(self, user_id: str, contact_id: str) -> bool:
        """Check if a contact is blocked."""
        row = self.db.fetchone(
            "SELECT is_blocked FROM contacts WHERE user_id = ? AND contact_id = ?",
            (user_id, contact_id),
        )
        if row is None:
            return False
        return bool(row["is_blocked"])

    def get_blocked(self, user_id: str) -> list[dict]:
        """Get all blocked contacts."""
        rows = self.db.fetchall(
            "SELECT * FROM contacts WHERE user_id = ? AND is_blocked = 1",
            (user_id,),
        )
        return [dict(row) for row in rows]

    def is_contact(self, user_id: str, contact_id: str) -> bool:
        """Check if a user is in contacts."""
        row = self.db.fetchone(
            "SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?",
            (user_id, contact_id),
        )
        return row is not None
