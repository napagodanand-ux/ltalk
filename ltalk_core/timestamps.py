"""Timestamp helpers — unified epoch-seconds representation.

Server returns TIMESTAMPTZ values as ISO-8601 strings (or epoch ints
from views we control); the local DB stores integer epoch seconds.
These helpers bridge the two consistently.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any


def to_epoch(value: Any) -> float:
    """Coerce a server timestamp (ISO string, epoch number, datetime) to epoch seconds."""
    if value is None:
        return 0.0
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.timestamp()
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return 0.0
        try:
            return float(text)
        except ValueError:
            pass
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.timestamp()
    raise TypeError(f"Unsupported timestamp type: {type(value)!r}")
