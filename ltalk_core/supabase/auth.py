"""Supabase Auth operations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .client import SupabaseClient


class AuthError(Exception):
    """Raised when a Supabase auth operation fails."""


@dataclass
class AuthResult:
    """Result of an authentication operation."""

    access_token: str
    refresh_token: str
    user_id: str
    email: str
    expires_at: float


class SupabaseAuth:
    """Handles Supabase authentication (email/password)."""

    def __init__(self, client: SupabaseClient) -> None:
        self.client = client

    async def sign_up(
        self, email: str, password: str, display_name: str
    ) -> AuthResult:
        """Register a new user with email and password."""
        response = await self.client.http.post(
            "/auth/v1/signup",
            json={
                "email": email,
                "password": password,
                "data": {"display_name": display_name},
            },
            headers={"apikey": self.client.config.anon_key},
        )
        if not response.is_success:
            data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            msg = data.get("msg", data.get("message", response.text))
            raise AuthError(msg)
        data = response.json()

        user = data.get("user", {})
        session = data.get("session", {})

        return AuthResult(
            access_token=session.get("access_token", ""),
            refresh_token=session.get("refresh_token", ""),
            user_id=user.get("id", ""),
            email=user.get("email", ""),
            expires_at=session.get("expires_at", 0),
        )

    async def sign_in(self, email: str, password: str) -> AuthResult:
        """Sign in with email and password."""
        response = await self.client.http.post(
            "/auth/v1/token?grant_type=password",
            json={"email": email, "password": password},
            headers={"apikey": self.client.config.anon_key},
        )
        if not response.is_success:
            data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            msg = data.get("msg", data.get("message", response.text))
            raise AuthError(msg)
        data = response.json()

        user = data.get("user", {})

        return AuthResult(
            access_token=data.get("access_token", ""),
            refresh_token=data.get("refresh_token", ""),
            user_id=user.get("id", ""),
            email=user.get("email", ""),
            expires_at=data.get("expires_at", 0),
        )

    async def refresh_token(self, refresh_token: str) -> AuthResult:
        """Refresh an expired access token."""
        response = await self.client.http.post(
            "/auth/v1/token?grant_type=refresh_token",
            json={"refresh_token": refresh_token},
            headers={"apikey": self.client.config.anon_key},
        )
        if not response.is_success:
            data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            msg = data.get("msg", data.get("message", response.text))
            raise AuthError(msg)
        data = response.json()

        user = data.get("user", {})

        return AuthResult(
            access_token=data.get("access_token", ""),
            refresh_token=data.get("refresh_token", ""),
            user_id=user.get("id", ""),
            email=user.get("email", ""),
            expires_at=data.get("expires_at", 0),
        )

    async def sign_out(self) -> None:
        """Sign out the current user."""
        if not self.client.is_authenticated:
            return
        try:
            await self.client.http.post(
                "/auth/v1/logout",
                headers=self.client.headers,
            )
        finally:
            self.client.clear_tokens()

    async def reset_password(self, email: str) -> None:
        """Send a password reset email."""
        response = await self.client.http.post(
            "/auth/v1/recover",
            json={"email": email},
            headers={"apikey": self.client.config.anon_key},
        )
        if not response.is_success:
            data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
            msg = data.get("msg", data.get("message", response.text))
            raise AuthError(msg)

    async def get_user(self) -> Optional[dict]:
        """Get the current authenticated user."""
        if not self.client.is_authenticated:
            return None
        response = await self.client.http.get(
            "/auth/v1/user",
            headers=self.client.headers,
        )
        if response.status_code != 200:
            return None
        return response.json()
