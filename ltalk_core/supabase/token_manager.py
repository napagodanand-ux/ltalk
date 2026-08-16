"""Central token lifecycle manager with proactive refresh.

Both the GUI and the daemon run one TokenManager against the same
local_user row, so rotated tokens stay in sync across processes
via the shared SQLite database; no IPC token handoff is required.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)

# Refresh before expiry: wake up when 75% of the remaining lifetime
# has passed, but never later than 60s before expiry.
REFRESH_EARLY_FRACTION = 0.75
REFRESH_GRACE_SECONDS = 60.0
MIN_CHECK_INTERVAL = 300.0
RETRY_BACKOFF = 300.0


def _decode_exp(access_token: str) -> float | None:
    """Extract the exp claim (epoch seconds) from an unverified JWT."""
    try:
        payload = access_token.split(".")[1]
        padded = payload + "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(padded))
        return float(claims["exp"])
    except Exception:
        return None


def _schedule_coroutine(coro: Any) -> None:
    """Run a coroutine from a sync callback, logging failures."""
    async def _run(c: Any) -> None:
        try:
            await c
        except Exception as e:
            logger.error("Token update callback failed: %s", e)

    try:
        asyncio.ensure_future(_run(coro))
    except RuntimeError:
        logger.debug("No running event loop for token update callback")


class TokenManager:
    """Owns access-token refresh for one process.

    Refreshes shortly before the access token expires using the stored
    refresh token, persists the rotated tokens, and notifies a
    registered callback (e.g. to reconnect Realtime with the new JWT).
    """

    def __init__(self, client: Any, auth: Any, db: Any) -> None:
        self._client = client  # SupabaseClient
        self._auth = auth  # SupabaseAuth
        self._db = db  # local Database
        self._task: asyncio.Task[Any] | None = None
        self._lock = asyncio.Lock()
        self._token_updated_callback: Callable[..., Any] | None = None
        self._stopped = False

    def on_token_updated(self, callback: Callable[..., Any]) -> None:
        """Register a callback invoked after successful rotation."""
        self._token_updated_callback = callback

    def is_running(self) -> bool:
        return self._task is not None

    async def start(self) -> None:
        """Start the proactive refresh loop."""
        if self._task is None:
            self._task = asyncio.create_task(self._run())
            logger.info("TokenManager started")

    async def stop(self) -> None:
        """Stop the refresh loop."""
        self._stopped = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            logger.info("TokenManager stopped")

    async def refresh_now(self) -> bool:
        """Force a token refresh. Returns True on success."""
        async with self._lock:
            refresh_token = getattr(self._client, "_refresh_token", None)
            if not refresh_token:
                logger.debug("No refresh token available; skipping refresh")
                return False
            try:
                result = await self._auth.refresh_token(refresh_token)
            except Exception as e:
                logger.warning("Token refresh failed: %s", e)
                return False
            self._apply_tokens(
                result.access_token, result.refresh_token, result.expires_at
            )
            return True

    def _apply_tokens(self, access_token: str, refresh_token: str, expires_at: float) -> None:
        """Rotate tokens in memory, persist, and notify listeners."""
        self._client.set_tokens(access_token, refresh_token)
        try:
            self._db.execute(
                "UPDATE local_user SET jwt = ?, refresh_token = ?, jwt_expires_at = ?",
                (access_token, refresh_token, int(expires_at)),
            )
            self._db.commit()
        except Exception as e:
            logger.warning("Failed to persist refreshed tokens: %s", e)

        if self._token_updated_callback:
            try:
                result = self._token_updated_callback()
                if asyncio.iscoroutine(result):
                    _schedule_coroutine(result)
            except Exception as e:
                logger.error("Token updated callback error: %s", e)

    def _seconds_until_refresh(self) -> float:
        """Seconds to wait before the next refresh attempt."""
        exp = _decode_exp(getattr(self._client, "_access_token", "") or "")
        if exp is None:
            return MIN_CHECK_INTERVAL
        ttl = exp - time.time()
        if ttl <= REFRESH_GRACE_SECONDS:
            return 0.0
        return ttl - max(REFRESH_EARLY_FRACTION * ttl, REFRESH_GRACE_SECONDS)

    async def _run(self) -> None:
        while not self._stopped:
            delay = self._seconds_until_refresh()
            try:
                await asyncio.sleep(max(delay, 1.0))
            except asyncio.CancelledError:
                break
            if self._stopped:
                break
            if not await self.refresh_now():
                try:
                    await asyncio.sleep(RETRY_BACKOFF)
                except asyncio.CancelledError:
                    break
