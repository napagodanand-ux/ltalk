"""
Secure key storage using the Secret Service API (libsecret/KWallet).

This module provides secure encryption key storage by integrating with the
desktop's native keyring (GNOME Keyring, KDE Wallet, etc.).
"""

from __future__ import annotations

import logging
import os
import secrets
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_SERVICE_NAME = "ltalk"
_LABEL = "LTalk Database Encryption Key"


class KeyringError(Exception):
    """Raised when keyring operations fail."""


def _get_keyring_backend():
    """Try to import and configure the keyring backend."""
    try:
        import secretstorage
        return "secretstorage"
    except ImportError:
        pass

    try:
        import keyring
        return "keyring"
    except ImportError:
        pass

    return None


def _get_or_create_keyring_key(
    service: str = _SERVICE_NAME,
    label: str = _LABEL,
) -> bytes:
    """
    Get or create a 32-byte encryption key in the desktop keyring.

    Uses Secret Service API via secretstorage or python-keyring.
    Returns the raw 32-byte key.
    """
    backend = _get_keyring_backend()

    if backend == "secretstorage":
        return _get_key_secretstorage(service, label)
    elif backend == "keyring":
        return _get_key_python_keyring(service, label)
    else:
        raise KeyringError(
            "No keyring backend available. Install one of:\n"
            "  - secretstorage (recommended)\n"
            "  - python-keyring\n"
            "On Ubuntu/Debian: sudo apt install python3-secretstorage\n"
            "On Fedora: sudo dnf install python3-secretstorage"
        )


def _get_key_secretstorage(service: str, label: str) -> bytes:
    """Get key using secretstorage (Secret Service API)."""
    import secretstorage

    bus = secretstorage.dbus_init()
    collection = secretstorage.get_default_collection(bus)

    if collection.is_locked():
        collection.unlock()

    # Look for existing key
    for item in collection.get_all_items():
        if item.get_label() == label:
            key = item.get_secret()
            if len(key) == 32:
                logger.debug("Retrieved encryption key from keyring")
                return key
            # Key exists but wrong length, regenerate
            logger.warning("Existing key has wrong length, regenerating")
            item.delete()

    # Generate new key
    new_key = secrets.token_bytes(32)
    collection.create_item(
        label,
        {
            "application": service,
            "purpose": "encryption",
        },
        new_key,
        content_type="application/octet-stream",
        replace=True,
    )
    logger.info("Generated new encryption key and stored in keyring")
    return new_key


def _get_key_python_keyring(service: str, label: str) -> bytes:
    """Get key using python-keyring."""
    import keyring

    key_name = f"{service}-encryption-key"

    # Try to get existing key
    existing = keyring.get_password(service, key_name)
    if existing:
        # Decode hex-encoded key
        try:
            key = bytes.fromhex(existing)
            if len(key) == 32:
                logger.debug("Retrieved encryption key from keyring")
                return key
        except ValueError:
            pass

        # Try base64
        try:
            import base64
            key = base64.b64decode(existing)
            if len(key) == 32:
                logger.debug("Retrieved encryption key from keyring")
                return key
        except (ValueError, base64.binascii.Error):
            pass

    # Generate new key
    new_key = secrets.token_bytes(32)
    keyring.set_password(service, key_name, new_key.hex())
    logger.info("Generated new encryption key and stored in keyring")
    return new_key


def get_or_create_key() -> bytes:
    """
    Get or create the database encryption key.

    This is the main entry point. It tries to use the desktop keyring,
    falling back to a file-based key only as a last resort.

    Returns:
        32-byte encryption key
    """
    try:
        return _get_or_create_keyring_key()
    except KeyringError:
        logger.warning("Keyring unavailable, falling back to file-based key")
        return _get_or_create_file_key()
    except (ImportError, OSError) as e:
        logger.warning("Keyring error (%s), falling back to file-based key", e)
        return _get_or_create_file_key()


def _get_or_create_file_key() -> bytes:
    """
    Fallback: store key in a file with restricted permissions.
    This is less secure than keyring but better than no encryption.
    """
    key_file = Path.home() / ".local" / "share" / "ltalk" / ".encryption_key"

    if key_file.exists():
        key = key_file.read_bytes()
        if len(key) == 32:
            return key

    # Generate new key
    new_key = secrets.token_bytes(32)
    key_file.parent.mkdir(parents=True, exist_ok=True)
    key_file.write_bytes(new_key)
    os.chmod(key_file, 0o600)
    logger.info("Generated new encryption key (file-based storage)")
    return new_key
