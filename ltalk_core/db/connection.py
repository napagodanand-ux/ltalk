"""SQLCipher database connection manager."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

try:
    from pysqlcipher3 import dbapi2 as sqlite

    _HAS_SQLCIPHER = True
except ImportError:
    import sqlite3 as sqlite  # type: ignore[no-redef]

    _HAS_SQLCIPHER = False


_DEFAULT_DB_DIR = Path.home() / ".local" / "share" / "ltalk"
_DEFAULT_DB_NAME = "ltalk.db"


class Database:
    """Encrypted SQLite database using SQLCipher (falls back to sqlite3)."""

    def __init__(
        self,
        db_path: Optional[Path] = None,
        encryption_key: Optional[str] = None,
    ) -> None:
        self._db_path = db_path or (_DEFAULT_DB_DIR / _DEFAULT_DB_NAME)
        self._encryption_key = encryption_key or self._get_encryption_key()
        self._conn: Optional[Any] = None

    @staticmethod
    def _get_encryption_key() -> str:
        """
        Get encryption key from secure storage (keyring) or generate one.

        Uses the Secret Service API (GNOME Keyring, KDE Wallet) when available.
        Falls back to file-based storage with restricted permissions.
        """
        from ltalk_core.crypto.keyring import get_or_create_key
        key_bytes = get_or_create_key()
        return key_bytes.hex()

    def connect(self) -> None:
        """Open the database connection."""
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite.connect(str(self._db_path))
        if _HAS_SQLCIPHER:
            self._conn.execute("PRAGMA key = ?", (self._encryption_key,))
            self._conn.execute("PRAGMA cipher_compatibility = 4")
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA journal_mode = WAL")
        self._conn.row_factory = sqlite.Row

    def close(self) -> None:
        """Close the database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None

    @property
    def conn(self) -> Any:
        if self._conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._conn

    def execute(self, query: str, params: tuple = ()) -> Any:
        """Execute a single query."""
        return self.conn.execute(query, params)

    def executemany(self, query: str, params_list: list[tuple]) -> Any:
        """Execute a query with many parameter sets."""
        return self.conn.executemany(query, params_list)

    def fetchone(self, query: str, params: tuple = ()) -> Optional[sqlite.Row]:
        """Fetch a single row."""
        cursor = self.execute(query, params)
        return cursor.fetchone()

    def fetchall(self, query: str, params: tuple = ()) -> list[sqlite.Row]:
        """Fetch all rows."""
        cursor = self.execute(query, params)
        return cursor.fetchall()

    def commit(self) -> None:
        """Commit the current transaction."""
        self.conn.commit()

    def rollback(self) -> None:
        """Rollback the current transaction."""
        self.conn.rollback()

    def begin_transaction(self) -> None:
        """Begin an explicit transaction."""
        self.conn.execute("BEGIN TRANSACTION")

    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists."""
        row = self.fetchone(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,),
        )
        return row is not None

    def get_schema_version(self) -> int:
        """Get the current schema version."""
        if not self.table_exists("schema_version"):
            return 0
        row = self.fetchone("SELECT MAX(version) as v FROM schema_version")
        if row is None:
            return 0
        return row["v"] or 0

    def set_schema_version(self, version: int) -> None:
        """Set the schema version."""
        import time
        self.execute(
            "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
            (version, int(time.time())),
        )
        self.commit()
