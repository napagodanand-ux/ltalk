"""Input validation utilities for LTalk."""

from __future__ import annotations

import os
import re
import uuid

from ltalk_core.exceptions import ValidationError

# Patterns
_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

# Limits
MAX_EMAIL_LEN = 254
MAX_PASSWORD_LEN = 128
MIN_PASSWORD_LEN = 8
MAX_DISPLAY_NAME_LEN = 50
MAX_MESSAGE_LEN = 10_000
MAX_QUERY_LEN = 50
MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB
ALLOWED_IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
ALLOWED_DOC_TYPES = {".pdf", ".doc", ".docx", ".txt", ".odt"}


def validate_email(email: str) -> str:
    """Validate and normalize email. Returns stripped email."""
    email = email.strip().lower()
    if not email:
        raise ValidationError("Email is required")
    if len(email) > MAX_EMAIL_LEN:
        raise ValidationError(f"Email too long (max {MAX_EMAIL_LEN} chars)")
    if not _EMAIL_RE.match(email):
        raise ValidationError("Invalid email format")
    return email


def validate_password(password: str) -> str:
    """Validate password strength. Returns the password as-is."""
    if not password:
        raise ValidationError("Password is required")
    if len(password) < MIN_PASSWORD_LEN:
        raise ValidationError(f"Password must be at least {MIN_PASSWORD_LEN} characters")
    if len(password) > MAX_PASSWORD_LEN:
        raise ValidationError(f"Password too long (max {MAX_PASSWORD_LEN} chars)")
    return password


def validate_display_name(name: str) -> str:
    """Validate and normalize display name."""
    name = name.strip()
    if not name:
        raise ValidationError("Display name is required")
    if len(name) > MAX_DISPLAY_NAME_LEN:
        raise ValidationError(f"Display name too long (max {MAX_DISPLAY_NAME_LEN} chars)")
    return name


def validate_message_content(content: str) -> str:
    """Validate message content."""
    content = content.strip()
    if not content:
        raise ValidationError("Message cannot be empty")
    if len(content) > MAX_MESSAGE_LEN:
        raise ValidationError(f"Message too long (max {MAX_MESSAGE_LEN} chars)")
    return content


def validate_query(query: str) -> str:
    """Validate search query."""
    query = query.strip()
    if not query:
        raise ValidationError("Search query cannot be empty")
    if len(query) > MAX_QUERY_LEN:
        raise ValidationError(f"Query too long (max {MAX_QUERY_LEN} chars)")
    return query


def validate_uuid(value: str, field_name: str = "ID") -> str:
    """Validate UUID format."""
    if not _UUID_RE.match(value):
        raise ValidationError(f"Invalid {field_name} format")
    return value


def validate_file_path(file_path: str) -> str:
    """Validate file path — no traversal, must exist."""
    if not file_path:
        raise ValidationError("File path is required")

    # Resolve and check for traversal
    resolved = os.path.realpath(file_path)
    if ".." in file_path:
        raise ValidationError("File path contains traversal")

    if not os.path.isfile(resolved):
        raise ValidationError("File does not exist")

    # Check file size
    size = os.path.getsize(resolved)
    if size > MAX_FILE_SIZE_BYTES:
        raise ValidationError(f"File too large (max {MAX_FILE_SIZE_BYTES // (1024*1024)} MB)")

    return resolved


def validate_file_type(file_path: str, expected_type: str) -> str:
    """Validate file extension matches expected type."""
    ext = os.path.splitext(file_path)[1].lower()

    if expected_type == "image":
        if ext not in ALLOWED_IMAGE_TYPES:
            raise ValidationError(f"Invalid image type: {ext}")
    elif expected_type == "document":
        if ext not in ALLOWED_DOC_TYPES:
            raise ValidationError(f"Invalid document type: {ext}")

    return file_path
