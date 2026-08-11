"""High-level encrypt/decrypt pipeline for messages."""

from __future__ import annotations

import base64
import json
from typing import Any, Optional

from .key_store import KeyStore
from .session_cache import SessionCache
from .signal_manager import SignalManager


class MessageEncryptor:
    """High-level message encryption/decryption using Signal Protocol.

    Coordinates between the Signal manager, key store, and session cache
    to provide a simple encrypt/decrypt interface.
    """

    def __init__(
        self,
        signal_manager: SignalManager,
        key_store: KeyStore,
        session_cache: SessionCache,
    ) -> None:
        self.signal = signal_manager
        self.key_store = key_store
        self.session_cache = session_cache

    async def encrypt_message(
        self,
        recipient_id: str,
        plaintext: str,
        supabase_client: Any = None,
    ) -> str:
        """Encrypt a message for a recipient.

        Args:
            recipient_id: The recipient's user ID.
            plaintext: The message text to encrypt.
            supabase_client: Optional Supabase client for fetching key bundles.

        Returns:
            Base64-encoded ciphertext string.
        """
        # Check cache first
        session_record = self.session_cache.get(recipient_id)
        if session_record is None:
            # Try loading from DB
            session_record = self.key_store.load_session(recipient_id)
            if session_record is None:
                # Need to establish a new session
                if supabase_client is not None:
                    session_record = await self._establish_new_session(
                        recipient_id, supabase_client
                    )
                else:
                    raise RuntimeError(
                        f"No session with {recipient_id} and no Supabase client provided"
                    )

        # Encrypt the message
        plaintext_bytes = plaintext.encode("utf-8")
        ciphertext = self.signal.encrypt(session_record, plaintext_bytes)

        # Cache the session
        self.session_cache.put(recipient_id, session_record)

        return base64.b64encode(ciphertext).decode("ascii")

    async def decrypt_message(
        self,
        sender_id: str,
        ciphertext_b64: str,
    ) -> str:
        """Decrypt a message from a sender.

        Args:
            sender_id: The sender's user ID.
            ciphertext_b64: Base64-encoded ciphertext.

        Returns:
            Decrypted plaintext string.
        """
        session_record = self.session_cache.get(sender_id)
        if session_record is None:
            session_record = self.key_store.load_session(sender_id)
            if session_record is None:
                raise RuntimeError(f"No session with {sender_id}")

        ciphertext = base64.b64decode(ciphertext_b64)
        plaintext_bytes = self.signal.decrypt(session_record, ciphertext)

        self.session_cache.put(sender_id, session_record)

        return plaintext_bytes.decode("utf-8")

    async def _establish_new_session(
        self,
        their_user_id: str,
        supabase_client: Any,
    ) -> bytes:
        """Establish a new Signal session using X3DH.

        Fetches the recipient's key bundle from Supabase and performs
        the Extended Triple Diffie-Hellman key agreement.
        """
        # Fetch key bundle from Supabase
        response = await supabase_client.http.get(
            f"/rest/v1/key_bundles?user_id=eq.{their_user_id}&select=*",
            headers=supabase_client.headers,
        )
        response.raise_for_status()
        bundles = response.json()
        if not bundles:
            raise RuntimeError(f"No key bundle found for user {their_user_id}")

        key_bundle = bundles[0]

        # Perform X3DH
        session_record = self.signal.establish_session(key_bundle)

        # Store the session
        self.key_store.save_session(their_user_id, 1, session_record)
        self.session_cache.put(their_user_id, session_record)

        return session_record

    async def encrypt_for_status(
        self,
        content: str,
        status_id: str,
    ) -> str:
        """Encrypt content for a status update.

        Statuses use a simpler symmetric encryption since all authorized
        viewers share the same key.
        """
        import hashlib
        import os

        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        key = hashlib.sha256(status_id.encode()).digest()
        plaintext = content.encode("utf-8")
        nonce = os.urandom(12)
        aesgcm = AESGCM(key)
        encrypted = aesgcm.encrypt(nonce, plaintext, None)
        return base64.b64encode(nonce + encrypted).decode("ascii")

    async def decrypt_status(
        self,
        ciphertext_b64: str,
        status_id: str,
    ) -> str:
        """Decrypt status content."""
        import hashlib

        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        key = hashlib.sha256(status_id.encode()).digest()
        raw = base64.b64decode(ciphertext_b64)
        nonce = raw[:12]
        ciphertext = raw[12:]
        aesgcm = AESGCM(key)
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode("utf-8")
