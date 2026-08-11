"""In-memory LRU cache for active Signal sessions."""

from __future__ import annotations

import collections
from typing import Optional


class SessionCache:
    """LRU cache for recently used Signal Protocol sessions.

    Keeps frequently accessed sessions in memory to avoid repeated DB lookups.
    """

    def __init__(self, max_size: int = 500) -> None:
        self._max_size = max_size
        self._cache: collections.OrderedDict[str, bytes] = collections.OrderedDict()

    def _make_key(self, user_id: str, device_id: int = 1) -> str:
        return f"{user_id}:{device_id}"

    def get(self, user_id: str, device_id: int = 1) -> Optional[bytes]:
        """Get a session from the cache. Moves to end (most recent)."""
        key = self._make_key(user_id, device_id)
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def put(self, user_id: str, session_record: bytes, device_id: int = 1) -> None:
        """Add or update a session in the cache."""
        key = self._make_key(user_id, device_id)
        self._cache[key] = session_record
        self._cache.move_to_end(key)
        while len(self._cache) > self._max_size:
            self._cache.popitem(last=False)

    def remove(self, user_id: str, device_id: int = 1) -> None:
        """Remove a session from the cache."""
        key = self._make_key(user_id, device_id)
        self._cache.pop(key, None)

    def clear(self) -> None:
        """Clear the entire cache."""
        self._cache.clear()

    @property
    def size(self) -> int:
        return len(self._cache)
