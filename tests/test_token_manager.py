"""Tests for the proactive token manager."""

from __future__ import annotations

import asyncio
import base64
import json
import time

from ltalk_core.supabase.token_manager import TokenManager, _decode_exp


def make_jwt(exp: float) -> str:
    """Build a minimal unsigned JWT carrying an exp claim."""
    header = base64.urlsafe_b64encode(b'{"alg":"none"}').decode().rstrip("=")
    payload = base64.urlsafe_b64encode(
        json.dumps({"exp": exp}).encode()
    ).decode().rstrip("=")
    return f"{header}.{payload}.sig"


class FakeAuth:
    def __init__(self):
        self.refreshed = 0

    async def refresh_token(self, refresh_token: str):
        self.refreshed += 1
        return type("Result", (), {
            "access_token": make_jwt(time.time() + 3600),
            "refresh_token": "rotated-refresh",
            "expires_at": time.time() + 3600,
        })()


class FakeClient:
    def __init__(self, jwt: str):
        self._access_token = jwt
        self._refresh_token = "refresh-1"

    def set_tokens(self, access_token, refresh_token=None):
        self._access_token = access_token
        if refresh_token:
            self._refresh_token = refresh_token


class FakeDb:
    def __init__(self):
        self.executed = []

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def commit(self):
        pass


class TestDecodeExp:
    def test_parses_exp_claim(self):
        exp = time.time() + 3600
        assert _decode_exp(make_jwt(exp)) == exp

    def test_garbage_token_returns_none(self):
        assert _decode_exp("not.a.token") is None
        assert _decode_exp("") is None


class TestTokenManager:
    def test_refresh_now_rotates_and_persists(self):
        client = FakeClient(make_jwt(time.time() + 3600))
        auth = FakeAuth()
        db = FakeDb()
        tm = TokenManager(client, auth, db)

        ok = asyncio.run(tm.refresh_now())
        assert ok
        assert auth.refreshed == 1
        assert client._refresh_token == "rotated-refresh"
        assert len(db.executed) == 1
        assert db.executed[0][0].startswith("UPDATE local_user")

    def test_refresh_now_without_refresh_token_fails(self):
        client = FakeClient(make_jwt(time.time() + 3600))
        client._refresh_token = None
        tm = TokenManager(client, FakeAuth(), FakeDb())

        ok = asyncio.run(tm.refresh_now())
        assert ok is False

    def test_refresh_callback_invoked(self):
        client = FakeClient(make_jwt(time.time() + 3600))
        auth = FakeAuth()
        tm = TokenManager(client, auth, FakeDb())
        calls = []
        tm.on_token_updated(lambda: calls.append("updated"))

        asyncio.run(tm.refresh_now())
        assert calls == ["updated"]

    def test_seconds_until_refresh_near_expiry_is_zero(self):
        client = FakeClient(make_jwt(time.time() + 30))
        tm = TokenManager(client, FakeAuth(), FakeDb())
        assert tm._seconds_until_refresh() == 0.0

    def test_seconds_until_refresh_negative_for_expired(self):
        client = FakeClient(make_jwt(time.time() - 10))
        tm = TokenManager(client, FakeAuth(), FakeDb())
        assert tm._seconds_until_refresh() == 0.0

    def test_seconds_until_refresh_unknown_token_uses_min_interval(self):
        tm = TokenManager(FakeClient(""), FakeAuth(), FakeDb())
        assert tm._seconds_until_refresh() == 300.0
