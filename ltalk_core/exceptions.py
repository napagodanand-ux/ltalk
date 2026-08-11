"""Custom exception types for LTalk."""

from __future__ import annotations


class LTalkError(Exception):
    """Base exception for all LTalk errors."""


class NetworkError(LTalkError):
    """Network request failed (timeout, connection refused, etc.)."""


class AuthError(LTalkError):
    """Authentication or token refresh failed."""


class DatabaseError(LTalkError):
    """Local database operation failed."""


class CryptoError(LTalkError):
    """Cryptographic operation failed (encrypt, decrypt, key generation)."""


class IPCError(LTalkError):
    """Inter-process communication failed."""


class ValidationError(LTalkError):
    """Input validation failed."""
