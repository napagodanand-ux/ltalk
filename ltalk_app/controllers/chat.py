"""Chat controller."""

from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ltalk_core.db.chats import ChatRepository
    from ltalk_core.db.messages import MessageRepository
    from ltalk_core.supabase.database import SupabaseDatabase
    from ltalk_core.types.chat import Chat

logger = logging.getLogger(__name__)


class ChatController:
    """Handles chat CRUD operations."""

    def __init__(
        self,
        chat_repo: ChatRepository,
        message_repo: MessageRepository,
        database: SupabaseDatabase,
    ) -> None:
        self._chat_repo = chat_repo
        self._message_repo = message_repo
        self._database = database

    def get_direct_chat(self, other_user_id: str) -> Chat | None:
        """Get existing direct chat with a user."""
        return self._chat_repo.get_direct_chat(other_user_id)

    async def create_direct_chat(
        self, current_user_id: str, other_user_id: str
    ) -> str:
        """Create a direct chat. Returns chat_id."""
        chat_data = await self._database.insert("chats", {"is_group": False})
        chat_id = chat_data[0]["id"]

        await self._database.insert("chat_members", [
            {"chat_id": chat_id, "user_id": current_user_id, "role": "admin"},
            {"chat_id": chat_id, "user_id": other_user_id, "role": "member"},
        ])

        my_profile = await self._database.select("profiles", filters={"id": current_user_id})
        other_profile = await self._database.select("profiles", filters={"id": other_user_id})

        my_name = my_profile[0]["display_name"] if my_profile else "You"
        other_name = other_profile[0]["display_name"] if other_profile else "Unknown"

        from ltalk_core.types.chat import Chat, ChatMember
        chat = Chat(
            id=chat_id,
            is_group=False,
            created_at=time.time(),
            updated_at=time.time(),
            members=[
                ChatMember(user_id=current_user_id, display_name=my_name),
                ChatMember(user_id=other_user_id, display_name=other_name),
            ],
        )
        self._chat_repo.insert(chat)
        for member in chat.members:
            self._chat_repo.insert_member(chat_id, member)

        return chat_id

    async def create_group(
        self, current_user_id: str, name: str, member_ids_json: str
    ) -> str:
        """Create a group chat. Returns chat_id."""
        member_ids = json.loads(member_ids_json)

        chat_data = await self._database.insert("chats", {
            "is_group": True,
            "group_name": name,
            "group_admin_id": current_user_id,
        })
        chat_id = chat_data[0]["id"]

        members_to_insert = [{"chat_id": chat_id, "user_id": current_user_id, "role": "admin"}]
        for mid in member_ids:
            members_to_insert.append({"chat_id": chat_id, "user_id": mid, "role": "member"})
        await self._database.insert("chat_members", members_to_insert)

        from ltalk_core.types.chat import Chat
        chat = Chat(
            id=chat_id,
            is_group=True,
            group_name=name,
            group_admin_id=current_user_id,
            created_at=time.time(),
            updated_at=time.time(),
        )
        self._chat_repo.insert(chat)
        return chat_id

    def delete_chat(self, chat_id: str) -> None:
        """Delete a chat locally."""
        self._chat_repo.delete(chat_id)

    async def delete_chat_remote(self, chat_id: str) -> None:
        """Delete a chat from Supabase."""
        try:
            await self._database.delete("chats", {"id": chat_id})
        except Exception as e:
            logger.warning("Failed to delete chat remotely: %s", e)

    def toggle_mute(self, chat_id: str) -> bool:
        """Toggle mute on a chat."""
        return self._chat_repo.toggle_mute(chat_id)

    def toggle_archive(self, chat_id: str) -> bool:
        """Toggle archive on a chat."""
        return self._chat_repo.toggle_archive(chat_id)

    def get_all_chats(self, include_archived: bool = False) -> list:
        """Get all chats."""
        return self._chat_repo.get_all(include_archived=include_archived)

    def get_total_unread(self) -> int:
        """Get total unread count."""
        return self._chat_repo.get_total_unread()
