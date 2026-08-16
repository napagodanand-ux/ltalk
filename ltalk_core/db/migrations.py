"""Database schema migrations."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .connection import Database

MIGRATIONS: list[str] = [
    # Migration 001: Initial Schema
    """
    CREATE TABLE IF NOT EXISTS local_user (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        about TEXT DEFAULT '',
        avatar_url TEXT,
        jwt TEXT NOT NULL,
        refresh_token TEXT NOT NULL DEFAULT '',
        jwt_expires_at INTEGER NOT NULL,
        identity_key_private BLOB,
        identity_key_public BLOB,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        is_group INTEGER NOT NULL DEFAULT 0,
        group_name TEXT,
        group_avatar_url TEXT,
        group_admin_id TEXT,
        last_message_preview TEXT,
        last_message_at INTEGER,
        unread_count INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        disappearing_duration INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_members (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        role TEXT DEFAULT 'member',
        joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (chat_id, user_id),
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        message_type TEXT NOT NULL,
        encrypted_content TEXT NOT NULL,
        plaintext_content TEXT,
        metadata_json TEXT DEFAULT '{}',
        reply_to TEXT,
        is_forwarded INTEGER DEFAULT 0,
        is_starred INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        edited_at INTEGER,
        deleted_for_me INTEGER DEFAULT 0,
        deleted_for_everyone INTEGER DEFAULT 0,
        disappearing_until INTEGER,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

    CREATE TABLE IF NOT EXISTS message_status (
        message_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'sent',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS signal_sessions (
        user_id TEXT NOT NULL,
        device_id INTEGER NOT NULL DEFAULT 1,
        session_record BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, device_id)
    );

    CREATE TABLE IF NOT EXISTS signal_pre_keys (
        key_id INTEGER NOT NULL,
        public_key BLOB NOT NULL,
        private_key BLOB NOT NULL,
        is_signed INTEGER DEFAULT 0,
        PRIMARY KEY (key_id)
    );

    CREATE TABLE IF NOT EXISTS signal_signed_pre_key (
        key_id INTEGER NOT NULL PRIMARY KEY,
        public_key BLOB NOT NULL,
        private_key BLOB NOT NULL,
        signature BLOB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
        user_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        about TEXT,
        is_blocked INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, contact_id)
    );

    CREATE TABLE IF NOT EXISTS statuses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        status_type TEXT NOT NULL,
        encrypted_content TEXT NOT NULL,
        plaintext_content TEXT,
        background_color TEXT DEFAULT '#A52A2A',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        privacy TEXT DEFAULT 'contacts',
        privacy_data_json TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS status_views (
        status_id TEXT NOT NULL,
        viewer_id TEXT NOT NULL,
        viewed_at INTEGER NOT NULL,
        PRIMARY KEY (status_id, viewer_id)
    );

    CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        caller_id TEXT NOT NULL,
        call_type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER,
        ended_at INTEGER,
        duration_seconds INTEGER,
        participants_json TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS offline_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        encrypted_content TEXT NOT NULL,
        message_type TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}',
        reply_to TEXT,
        created_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_retry_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
    """,
    # Migration 002: Offline queue send metadata for reliable delivery
    """
    ALTER TABLE offline_queue ADD COLUMN message_id TEXT;
    ALTER TABLE offline_queue ADD COLUMN sender_id TEXT;
    """,
]


def run_migrations(db: Database) -> None:
    """Apply all pending database migrations (append-only, versioned)."""
    current_version = db.get_schema_version()

    for i, migration_sql in enumerate(MIGRATIONS, start=1):
        if i > current_version:
            db.begin_transaction()
            try:
                db.conn.executescript(migration_sql)
                db.set_schema_version(i)
            except Exception:
                db.rollback()
                raise
