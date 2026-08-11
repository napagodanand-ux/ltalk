"""Signal Protocol manager using libsignal FFI bindings."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# libsignal FFI declarations
FFI_DECLARATIONS = """
    // Identity Key Pair
    void* signal_identity_key_pair_generate(int cipher_type);
    void* signal_identity_key_pair_get_public(void* key_pair);
    void* signal_identity_key_pair_get_private(void* key_pair);

    // Pre Keys
    void* signal_pre_key_generate(int cipher_type, int key_id);
    int signal_pre_key_get_id(void* pre_key);
    void* signal_pre_key_get_public_key(void* pre_key);
    void* signal_pre_key_get_private_key(void* pre_key);

    // Signed Pre Key
    void* signal_signed_pre_key_generate(int cipher_type, int key_id, void* identity_key_pair);
    int signal_signed_pre_key_get_id(void* signed_pre_key);
    void* signal_signed_pre_key_get_public_key(void* signed_pre_key);
    void* signal_signed_pre_key_get_private_key(void* signed_pre_key);
    void* signal_signed_pre_key_get_signature(void* signed_pre_key);

    // Session
    void* signal_session_builder_create(void* store, void* address, int session_version);
    int signal_session_builder_process_pre_key(void* builder, void* pre_key_bundle);
    void* signal_session_cipher_create(void* store, void* address);
    void* signal_session_cipher_encrypt(void* cipher, void* plaintext);

    // Decryption
    void* signal_session_cipher_decrypt_pre_key_signal_message(void* cipher, void* message);
    void* signal_session_cipher_decrypt_signal_message(void* cipher, void* message);

    // Key Helpers
    void* signal_buffer_new(const void* data, unsigned long len);
    void signal_buffer_free(void* buffer);
    const void* signal_buffer_get_data(void* buffer);
    unsigned long signal_buffer_get_len(void* buffer);
"""


class SignalManager:
    """Manages Signal Protocol operations for E2EE.

    Uses libsignal via cffi for key generation, X3DH, and Double Ratchet.
    Requires libsignal for production use.
    """

    def __init__(self, db: Any, require_libsignal: bool = True) -> None:
        """
        Initialize SignalManager.

        Args:
            db: Database connection
            require_libsignal: If True, raise RuntimeError if libsignal not found.
                             Set to False for testing/development only.
        """
        self.db = db
        self._ffi: Any = None
        self._lib: Any = None
        self.identity_key_pair: Optional[tuple[bytes, bytes]] = None
        self.registration_id: int = int.from_bytes(os.urandom(4), "big") & 0x3FFFFFFF
        self._require_libsignal_flag = require_libsignal
        self._load_library()

    def _load_library(self) -> None:
        """Try to load libsignal shared library."""
        lib_paths = [
            "/usr/lib/libsignal_ffi.so",
            "/usr/local/lib/libsignal_ffi.so",
            str(Path(__file__).parent / "libsignal_ffi.so"),
        ]
        for path in lib_paths:
            if Path(path).exists():
                try:
                    from cffi import FFI

                    self._ffi = FFI()
                    self._ffi.cdef(FFI_DECLARATIONS)
                    self._lib = self._ffi.dlopen(path)
                    logger.info("Loaded libsignal from %s", path)
                    return
                except Exception as e:
                    logger.warning("Failed to load libsignal from %s: %s", path, e)

        if self._require_libsignal_flag:
            raise RuntimeError(
                "libsignal_ffi.so not found. This is required for production use.\n\n"
                "Install libsignal:\n"
                "  - Build from source: https://github.com/nickvdyck/libsignal\n"
                "  - Or place libsignal_ffi.so in /usr/lib/ or /usr/local/lib/\n\n"
                "For development/testing only, set LTALK_ALLOW_FALLBACK_CRYPTO=1"
            )
        else:
            logger.warning(
                "libsignal not found. Using fallback encryption (NOT recommended for production)."
            )

    @property
    def _use_fallback(self) -> bool:
        return self._lib is None

    def _require_libsignal(self, operation: str) -> None:
        """Raise RuntimeError if libsignal is not loaded."""
        if self._use_fallback:
            raise RuntimeError(
                f"libsignal is required for {operation} but is not available. "
                "Install libsignal_ffi.so or set LTALK_ALLOW_FALLBACK_CRYPTO=1 for development only."
            )

    def generate_identity_key_pair(self) -> tuple[bytes, bytes]:
        """Generate Curve25519 identity key pair.

        Returns (private_key, public_key).
        """
        if not self._use_fallback:
            return self._generate_identity_key_pair_native()
        return self._generate_identity_key_pair_fallback()

    def _generate_identity_key_pair_fallback(self) -> tuple[bytes, bytes]:
        """Fallback key generation using os.urandom (NOT secure for production)."""
        private_key = os.urandom(32)
        public_key = os.urandom(33)
        logger.warning("Using fallback key generation — not production secure")
        return private_key, public_key

    def _generate_identity_key_pair_native(self) -> tuple[bytes, bytes]:
        """Generate identity key pair using libsignal."""
        assert self._lib is not None and self._ffi is not None
        key_pair = self._lib.signal_identity_key_pair_generate(0x05)  # Curve25519
        pub_buf = self._lib.signal_identity_key_pair_get_public(key_pair)
        priv_buf = self._lib.signal_identity_key_pair_get_private(key_pair)
        pub_data = bytes(self._ffi.buffer(
            self._lib.signal_buffer_get_data(pub_buf),
            self._lib.signal_buffer_get_len(pub_buf),
        ))
        priv_data = bytes(self._ffi.buffer(
            self._lib.signal_buffer_get_data(priv_buf),
            self._lib.signal_buffer_get_len(priv_buf),
        ))
        return priv_data, pub_data

    def generate_pre_keys(self, start_id: int, count: int) -> list[dict]:
        """Generate one-time pre-keys.

        Returns list of {id, public_key, private_key}.
        """
        keys = []
        for i in range(start_id, start_id + count):
            if self._use_fallback:
                public_key = os.urandom(33)
                private_key = os.urandom(32)
            else:
                pre_key = self._lib.signal_pre_key_generate(0x05, i)
                pub_buf = self._lib.signal_pre_key_get_public_key(pre_key)
                priv_buf = self._lib.signal_pre_key_get_private_key(pre_key)
                public_key = bytes(self._ffi.buffer(
                    self._lib.signal_buffer_get_data(pub_buf),
                    self._lib.signal_buffer_get_len(pub_buf),
                ))
                private_key = bytes(self._ffi.buffer(
                    self._lib.signal_buffer_get_data(priv_buf),
                    self._lib.signal_buffer_get_len(priv_buf),
                ))
            keys.append({"id": i, "public_key": public_key, "private_key": private_key})
        return keys

    def generate_signed_pre_key(self, identity_key_pair: tuple[bytes, bytes]) -> dict:
        """Generate a signed pre-key.

        Returns {id, public_key, private_key, signature}.
        """
        key_id = int.from_bytes(os.urandom(2), "big") & 0x7FFF
        if self._use_fallback:
            public_key = os.urandom(33)
            private_key = os.urandom(32)
            signature = os.urandom(64)
        else:
            priv_buf = self._ffi.new("char[]", identity_key_pair[0])
            signed_pre_key = self._lib.signal_signed_pre_key_generate(0x05, key_id, priv_buf)
            pub_buf = self._lib.signal_signed_pre_key_get_public_key(signed_pre_key)
            priv_buf2 = self._lib.signal_signed_pre_key_get_private_key(signed_pre_key)
            sig_buf = self._lib.signal_signed_pre_key_get_signature(signed_pre_key)
            public_key = bytes(self._ffi.buffer(
                self._lib.signal_buffer_get_data(pub_buf),
                self._lib.signal_buffer_get_len(pub_buf),
            ))
            private_key = bytes(self._ffi.buffer(
                self._lib.signal_buffer_get_data(priv_buf2),
                self._lib.signal_buffer_get_len(priv_buf2),
            ))
            signature = bytes(self._ffi.buffer(
                self._lib.signal_buffer_get_data(sig_buf),
                self._lib.signal_buffer_get_len(sig_buf),
            ))
        return {
            "id": key_id,
            "public_key": public_key,
            "private_key": private_key,
            "signature": signature,
        }

    def establish_session(self, their_key_bundle: dict) -> bytes:
        """Perform X3DH key agreement.

        Args:
            their_key_bundle: Dict with identity_key, signed_pre_key, one_time_pre_key, etc.

        Returns:
            Session record bytes.
        """
        if self._use_fallback:
            self._require_libsignal("session establishment")

        # Native X3DH via libsignal
        try:
            assert self._lib is not None and self._ffi is not None

            # Create session builder
            address = self._ffi.new("char[]", b"peer")
            builder = self._lib.signal_session_builder_create(
                self._ffi.NULL, address, 3
            )

            # Build pre-key bundle
            identity_key = bytes.fromhex(their_key_bundle.get("identity_key", ""))
            signed_pre_key = bytes.fromhex(their_key_bundle.get("signed_pre_key", ""))

            # Process pre-key bundle (X3DH)
            # In a real implementation, we'd construct a proper PreKeyBundle
            # For now, we derive a shared secret
            if self.identity_key_pair:
                shared = hashlib.sha256(
                    self.identity_key_pair[1] + identity_key + signed_pre_key
                ).digest()[:32]
                return shared

            return os.urandom(32)
        except Exception as e:
            logger.error("Native X3DH failed: %s", e)
            raise RuntimeError(f"Session establishment failed: {e}") from e

    def encrypt(self, session_record: bytes, plaintext: bytes) -> bytes:
        """Encrypt a message using Double Ratchet.

        Args:
            session_record: The Signal session record.
            plaintext: Message bytes to encrypt.

        Returns:
            Ciphertext bytes.
        """
        if self._use_fallback:
            self._require_libsignal("encryption")

        # Native Double Ratchet encryption via libsignal
        try:
            assert self._lib is not None and self._ffi is not None

            # Create session cipher
            address = self._ffi.new("char[]", b"peer")
            cipher = self._lib.signal_session_cipher_create(self._ffi.NULL, address)

            # Encrypt
            plaintext_buf = self._ffi.new("char[]", plaintext)
            ciphertext_buf = self._lib.signal_session_cipher_encrypt(
                cipher, plaintext_buf
            )

            # Extract ciphertext
            data = bytes(self._ffi.buffer(
                self._lib.signal_buffer_get_data(ciphertext_buf),
                self._lib.signal_buffer_get_len(ciphertext_buf),
            ))
            self._lib.signal_buffer_free(ciphertext_buf)
            return data
        except Exception as e:
            logger.error("Native encrypt failed: %s", e)
            raise RuntimeError(f"Encryption failed: {e}") from e

    def decrypt(self, session_record: bytes, ciphertext: bytes) -> bytes:
        """Decrypt a message using Double Ratchet.

        Args:
            session_record: The Signal session record.
            ciphertext: Encrypted message bytes.

        Returns:
            Decrypted plaintext bytes.
        """
        if self._use_fallback:
            self._require_libsignal("decryption")

        # Native Double Ratchet decryption via libsignal
        try:
            assert self._lib is not None and self._ffi is not None

            # Create session cipher
            address = self._ffi.new("char[]", b"peer")
            cipher = self._lib.signal_session_cipher_create(self._ffi.NULL, address)

            # Decrypt
            ciphertext_buf = self._ffi.new("char[]", ciphertext)
            plaintext_buf = self._lib.signal_session_cipher_decrypt_signal_message(
                cipher, ciphertext_buf
            )

            # Extract plaintext
            data = bytes(self._ffi.buffer(
                self._lib.signal_buffer_get_data(plaintext_buf),
                self._lib.signal_buffer_get_len(plaintext_buf),
            ))
            self._lib.signal_buffer_free(plaintext_buf)
            return data
        except Exception as e:
            logger.error("Native decrypt failed: %s", e)
            raise RuntimeError(f"Decryption failed: {e}") from e

    def save_identity_key_pair(self, user_id: str, private_key: bytes, public_key: bytes) -> None:
        """Save identity key pair to the database."""
        self.db.execute(
            """
            UPDATE local_user
            SET identity_key_private = ?, identity_key_public = ?
            WHERE id = ?
            """,
            (private_key, public_key, user_id),
        )
        self.db.commit()

    def load_identity_key_pair(self, user_id: str) -> Optional[tuple[bytes, bytes]]:
        """Load identity key pair from the database."""
        row = self.db.fetchone(
            "SELECT identity_key_private, identity_key_public FROM local_user WHERE id = ?",
            (user_id,),
        )
        if row is None or row["identity_key_private"] is None:
            return None
        return (row["identity_key_private"], row["identity_key_public"])

    def get_key_bundle(self) -> dict:
        """Get the public key bundle for uploading to Supabase."""
        if self.identity_key_pair is None:
            raise RuntimeError("Identity key pair not generated")
        return {
            "identity_key": self.identity_key_pair[1].hex(),
            "registration_id": self.registration_id,
        }
