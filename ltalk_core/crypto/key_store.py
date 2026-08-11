"""Signal Protocol key storage in SQLCipher."""

from __future__ import annotations

from typing import Any, Optional

from ..db.connection import Database


class KeyStore:
    """Stores Signal Protocol key material in the encrypted local database."""

    def __init__(self, db: Database) -> None:
        self.db = db

    def save_identity_key_pair(self, user_id: str, private_key: bytes, public_key: bytes) -> None:
        """Save the user's identity key pair."""
        self.db.execute(
            "UPDATE local_user SET identity_key_private = ?, identity_key_public = ? WHERE id = ?",
            (private_key, public_key, user_id),
        )
        self.db.commit()

    def load_identity_key_pair(self, user_id: str) -> Optional[tuple[bytes, bytes]]:
        """Load the user's identity key pair."""
        row = self.db.fetchone(
            "SELECT identity_key_private, identity_key_public FROM local_user WHERE id = ?",
            (user_id,),
        )
        if row is None or row["identity_key_private"] is None:
            return None
        return (row["identity_key_private"], row["identity_key_public"])

    def save_pre_keys(self, keys: list[dict]) -> None:
        """Save one-time pre-keys."""
        for key in keys:
            self.db.execute(
                "INSERT OR REPLACE INTO signal_pre_keys (key_id, public_key, private_key, is_signed) VALUES (?, ?, ?, 0)",
                (key["id"], key["public_key"], key["private_key"]),
            )
        self.db.commit()

    def get_pre_key(self, key_id: int) -> Optional[dict]:
        """Get a pre-key by ID."""
        row = self.db.fetchone(
            "SELECT * FROM signal_pre_keys WHERE key_id = ?", (key_id,)
        )
        if row is None:
            return None
        return {
            "id": row["key_id"],
            "public_key": row["public_key"],
            "private_key": row["private_key"],
        }

    def get_unused_pre_key(self) -> Optional[dict]:
        """Get an unused pre-key for session establishment."""
        row = self.db.fetchone(
            "SELECT * FROM signal_pre_keys ORDER BY key_id ASC LIMIT 1"
        )
        if row is None:
            return None
        return {
            "id": row["key_id"],
            "public_key": row["public_key"],
            "private_key": row["private_key"],
        }

    def consume_pre_key(self, key_id: int) -> None:
        """Remove a pre-key after it has been used."""
        self.db.execute("DELETE FROM signal_pre_keys WHERE key_id = ?", (key_id,))
        self.db.commit()

    def save_signed_pre_key(self, key_id: int, public_key: bytes, private_key: bytes, signature: bytes) -> None:
        """Save the signed pre-key."""
        self.db.execute(
            "INSERT OR REPLACE INTO signal_signed_pre_key (key_id, public_key, private_key, signature) VALUES (?, ?, ?, ?)",
            (key_id, public_key, private_key, signature),
        )
        self.db.commit()

    def get_signed_pre_key(self) -> Optional[dict]:
        """Get the current signed pre-key."""
        row = self.db.fetchone("SELECT * FROM signal_signed_pre_key LIMIT 1")
        if row is None:
            return None
        return {
            "id": row["key_id"],
            "public_key": row["public_key"],
            "private_key": row["private_key"],
            "signature": row["signature"],
        }

    def save_session(self, user_id: str, device_id: int, session_record: bytes) -> None:
        """Save a Signal session record."""
        import time

        self.db.execute(
            "INSERT OR REPLACE INTO signal_sessions (user_id, device_id, session_record, created_at) VALUES (?, ?, ?, ?)",
            (user_id, device_id, session_record, int(time.time())),
        )
        self.db.commit()

    def load_session(self, user_id: str, device_id: int = 1) -> Optional[bytes]:
        """Load a Signal session record."""
        row = self.db.fetchone(
            "SELECT session_record FROM signal_sessions WHERE user_id = ? AND device_id = ?",
            (user_id, device_id),
        )
        if row is None:
            return None
        return row["session_record"]

    def delete_session(self, user_id: str, device_id: int = 1) -> None:
        """Delete a Signal session."""
        self.db.execute(
            "DELETE FROM signal_sessions WHERE user_id = ? AND device_id = ?",
            (user_id, device_id),
        )
        self.db.commit()

    def get_all_sessions(self) -> list[dict]:
        """Get all stored sessions."""
        rows = self.db.fetchall("SELECT * FROM signal_sessions")
        return [
            {
                "user_id": row["user_id"],
                "device_id": row["device_id"],
                "session_record": row["session_record"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def pre_key_count(self) -> int:
        """Get the number of remaining pre-keys."""
        row = self.db.fetchone("SELECT COUNT(*) as c FROM signal_pre_keys")
        return row["c"] if row else 0
