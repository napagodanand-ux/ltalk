"""Settings / profile controller."""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ltalk_core.db.connection import Database
    from ltalk_core.supabase.database import SupabaseDatabase
    from ltalk_core.supabase.storage import SupabaseStorage

logger = logging.getLogger(__name__)


class SettingsController:
    """Handles profile updates and avatar uploads."""

    def __init__(
        self,
        db: Database,
        database: SupabaseDatabase,
        storage: SupabaseStorage,
    ) -> None:
        self._db = db
        self._database = database
        self._storage = storage

    async def update_profile(self, user_id: str, display_name: str, about: str) -> None:
        """Update user profile."""
        await self._database.update("profiles", {
            "display_name": display_name,
            "about": about,
        }, {"id": user_id})
        self._db.execute(
            "UPDATE local_user SET display_name = ?, about = ? WHERE id = ?",
            (display_name, about, user_id),
        )
        self._db.commit()

    async def upload_avatar(self, user_id: str, file_path: str) -> str:
        """Upload a profile avatar image. Returns avatar URL."""
        with open(file_path, "rb") as f:
            file_data = f.read()

        ext = os.path.splitext(file_path)[1] or ".png"
        storage_path = f"avatars/{user_id}{ext}"
        content_type = "image/png"
        if ext in (".jpg", ".jpeg"):
            content_type = "image/jpeg"
        elif ext == ".webp":
            content_type = "image/webp"

        await self._storage.upload_file("avatars", storage_path, file_data, content_type)
        avatar_url = await self._storage.get_public_url("avatars", storage_path)

        await self._database.update("profiles", {
            "avatar_url": avatar_url,
        }, {"id": user_id})

        self._db.execute(
            "UPDATE local_user SET avatar_url = ? WHERE id = ?",
            (avatar_url, user_id),
        )
        self._db.commit()

        return avatar_url

    def get_profile(self, user_id: str) -> dict | None:
        """Get profile from local DB."""
        return self._db.fetchone(
            "SELECT display_name, about, avatar_url FROM local_user WHERE id = ?",
            (user_id,),
        )
