"""Authentication controller."""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from ltalk_core.exceptions import AuthError
from ltalk_core.logging import get_context_filter

if TYPE_CHECKING:
    from ltalk_core.crypto.encrypt import MessageEncryptor
    from ltalk_core.crypto.key_store import KeyStore
    from ltalk_core.crypto.signal_manager import SignalManager
    from ltalk_core.db.connection import Database
    from ltalk_core.supabase.auth import SupabaseAuth
    from ltalk_core.supabase.client import SupabaseClient
    from ltalk_core.supabase.database import SupabaseDatabase

logger = logging.getLogger(__name__)


class AuthController:
    """Handles authentication, registration, and token management."""

    def __init__(
        self,
        db: Database,
        supabase: SupabaseClient,
        auth: SupabaseAuth,
        database: SupabaseDatabase,
        signal_manager: SignalManager,
        key_store: KeyStore,
        encryptor: MessageEncryptor,
    ) -> None:
        self._db = db
        self._supabase = supabase
        self._auth = auth
        self._database = database
        self._signal = signal_manager
        self._key_store = key_store
        self._encryptor = encryptor

    async def sign_in(self, email: str, password: str) -> str:
        """Sign in and return user_id."""
        result = await self._auth.sign_in(email, password)
        self._supabase.set_tokens(result.access_token, result.refresh_token)
        self._update_tokens(result.user_id, email, result.access_token, result.refresh_token, result.expires_at)

        ctx = get_context_filter()
        ctx.set_context(user_id=result.user_id)
        logger.info("User signed in")

        # Generate Signal keys if first login
        key_pair = self._signal.load_identity_key_pair(result.user_id)
        if key_pair is None:
            private_key, public_key = self._signal.generate_identity_key_pair()
            self._signal.save_identity_key_pair(result.user_id, private_key, public_key)
            self._key_store.save_identity_key_pair(result.user_id, private_key, public_key)
            pre_keys = self._signal.generate_pre_keys(1, 100)
            self._key_store.save_pre_keys(pre_keys)
            signed_pre_key = self._signal.generate_signed_pre_key((private_key, public_key))
            self._key_store.save_signed_pre_key(
                signed_pre_key["id"], signed_pre_key["public_key"],
                signed_pre_key["private_key"], signed_pre_key["signature"],
            )
            await self._upload_key_bundle(result.user_id, public_key, signed_pre_key, pre_keys)
        else:
            self._key_store.save_identity_key_pair(result.user_id, key_pair[0], key_pair[1])
            self._signal.identity_key_pair = key_pair

        return result.user_id

    async def sign_up(self, email: str, password: str, display_name: str) -> str:
        """Register and return user_id."""
        result = await self._auth.sign_up(email, password, display_name)
        self._supabase.set_tokens(result.access_token, result.refresh_token)

        self._db.execute(
            """
            INSERT OR REPLACE INTO local_user (id, email, display_name, jwt, refresh_token, jwt_expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (result.user_id, email, display_name, result.access_token, result.refresh_token, result.expires_at, int(time.time())),
        )
        self._db.commit()

        await self._database.insert("profiles", {
            "id": result.user_id,
            "display_name": display_name,
            "about": "",
        })

        private_key, public_key = self._signal.generate_identity_key_pair()
        self._signal.save_identity_key_pair(result.user_id, private_key, public_key)
        self._key_store.save_identity_key_pair(result.user_id, private_key, public_key)
        self._signal.identity_key_pair = (private_key, public_key)

        pre_keys = self._signal.generate_pre_keys(1, 100)
        self._key_store.save_pre_keys(pre_keys)
        signed_pre_key = self._signal.generate_signed_pre_key((private_key, public_key))
        self._key_store.save_signed_pre_key(
            signed_pre_key["id"], signed_pre_key["public_key"],
            signed_pre_key["private_key"], signed_pre_key["signature"],
        )
        await self._upload_key_bundle(result.user_id, public_key, signed_pre_key, pre_keys)

        return result.user_id

    async def sign_out(self) -> None:
        """Sign out the current user."""
        self._supabase.clear_tokens()
        self._db.execute("UPDATE local_user SET jwt = '', refresh_token = ''")
        self._db.commit()
        try:
            await self._auth.sign_out()
        except Exception as e:
            logger.debug("Sign out failed (non-critical): %s", e)

    async def refresh_token(self, refresh_token: str) -> tuple[str, str, float]:
        """Refresh the JWT. Returns (user_id, new_jwt, expires_at)."""
        result = await self._auth.refresh_token(refresh_token)
        self._update_tokens(result.user_id, "", result.access_token, result.refresh_token, result.expires_at)
        return result.user_id, result.access_token, result.expires_at

    def get_stored_session(self) -> dict | None:
        """Get stored session from local DB, or None."""
        row = self._db.fetchone(
            "SELECT id, email, display_name, jwt, refresh_token, jwt_expires_at FROM local_user LIMIT 1"
        )
        if row and row["jwt"]:
            return dict(row)
        return None

    def _update_tokens(self, user_id: str, email: str, jwt: str, refresh_token: str, expires_at: float) -> None:
        """Store auth tokens in local database."""
        self._db.execute(
            """
            INSERT INTO local_user (id, email, display_name, jwt, refresh_token, jwt_expires_at)
            VALUES (?, ?, '', ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                jwt = excluded.jwt,
                refresh_token = excluded.refresh_token,
                jwt_expires_at = excluded.jwt_expires_at
            """,
            (user_id, email, jwt, refresh_token, int(expires_at)),
        )
        self._db.commit()
        self._supabase.set_tokens(jwt, refresh_token)

    async def _upload_key_bundle(
        self, user_id: str, public_key: bytes, signed_pre_key: dict, pre_keys: list[dict]
    ) -> None:
        """Upload the key bundle to Supabase."""
        try:
            await self._database.upsert("key_bundles", {
                "user_id": user_id,
                "identity_key": public_key.hex(),
                "signed_pre_key_id": signed_pre_key["id"],
                "signed_pre_key": signed_pre_key["public_key"].hex(),
                "signed_pre_key_signature": signed_pre_key["signature"].hex(),
                "one_time_pre_keys": [{"id": k["id"], "key": k["public_key"].hex()} for k in pre_keys[:10]],
            })
        except Exception as e:
            logger.warning("Key bundle upload failed (may already exist): %s", e)
