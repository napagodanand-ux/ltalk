"""Contact controller."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ltalk_core.db.contacts import ContactRepository
    from ltalk_core.supabase.database import SupabaseDatabase

logger = logging.getLogger(__name__)


class ContactController:
    """Handles contact search, add, block, and unblock."""

    def __init__(
        self,
        contact_repo: ContactRepository,
        database: SupabaseDatabase,
    ) -> None:
        self._contact_repo = contact_repo
        self._database = database

    async def search_users(self, query: str) -> list[dict]:
        """Search for users by name or email. Returns list of profiles."""
        sanitized = query.strip().replace("%", "\\%").replace("_", "\\_")[:50]
        if not sanitized:
            return []
        try:
            results = await self._database.select(
                "profiles",
                filters={"display_name": f"ilike.*{sanitized}*"},
                limit=20,
            )
            return results
        except Exception as e:
            logger.error("Search users failed: %s", e)
            return []

    async def add_contact(self, current_user_id: str, user_id: str) -> None:
        """Add a user to contacts."""
        try:
            profile = await self._database.select("profiles", filters={"id": user_id})
            if profile:
                self._contact_repo.add(
                    current_user_id, user_id,
                    profile[0]["display_name"],
                    profile[0].get("avatar_url"),
                    profile[0].get("about"),
                )
        except Exception as e:
            logger.error("Failed to add contact: %s", e)

    async def block_user(self, current_user_id: str, user_id: str) -> None:
        """Block a user."""
        self._contact_repo.block(current_user_id, user_id)
        try:
            await self._database.insert("blocked_users", {
                "blocker_id": current_user_id,
                "blocked_id": user_id,
            })
        except Exception as e:
            logger.warning("Failed to block user remotely: %s", e)

    async def unblock_user(self, current_user_id: str, user_id: str) -> None:
        """Unblock a user."""
        self._contact_repo.unblock(current_user_id, user_id)
        try:
            await self._database.delete("blocked_users", {
                "blocker_id": current_user_id,
                "blocked_id": user_id,
            })
        except Exception as e:
            logger.warning("Failed to unblock user remotely: %s", e)

    def get_contacts(self, user_id: str) -> list:
        """Get all contacts for a user."""
        return self._contact_repo.get_all(user_id)

    def is_blocked(self, user_id: str, contact_id: str) -> bool:
        """Check if a contact is blocked."""
        return self._contact_repo.is_blocked(user_id, contact_id)
