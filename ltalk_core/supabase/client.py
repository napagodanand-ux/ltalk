"""Supabase client configuration and SDK wrapper."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import httpx


@dataclass
class SupabaseConfig:
    """Supabase project configuration.

    Only the anon key lives in the client. Privileged server-side
    operations (service-role) must go through Supabase Edge Functions.
    """

    url: str
    anon_key: str

    @property
    def api_url(self) -> str:
        return f"{self.url.rstrip('/')}/rest/v1"

    @property
    def auth_url(self) -> str:
        return f"{self.url.rstrip('/')}/auth/v1"

    @property
    def realtime_url(self) -> str:
        ws_url = self.url.replace("https://", "wss://").replace("http://", "ws://")
        return f"{ws_url.rstrip('/')}/realtime/v1/websocket"

    @property
    def storage_url(self) -> str:
        return f"{self.url.rstrip('/')}/storage/v1"

    @property
    def functions_url(self) -> str:
        return f"{self.url.rstrip('/')}/functions/v1"


class SupabaseClient:
    """Main Supabase client wrapping HTTP calls and providing auth/database/storage access."""

    def __init__(self, config: SupabaseConfig) -> None:
        self.config = config
        self._http: Optional[httpx.AsyncClient] = None
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None

    async def initialize(self) -> None:
        """Initialize the HTTP client."""
        self._http = httpx.AsyncClient(
            base_url=self.config.url.rstrip("/"),
            timeout=30.0,
            follow_redirects=True,
        )

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._http:
            await self._http.aclose()
            self._http = None

    @property
    def http(self) -> httpx.AsyncClient:
        if self._http is None:
            raise RuntimeError("Client not initialized. Call initialize() first.")
        return self._http

    def set_tokens(self, access_token: str, refresh_token: Optional[str] = None) -> None:
        """Set authentication tokens."""
        self._access_token = access_token
        if refresh_token:
            self._refresh_token = refresh_token

    def clear_tokens(self) -> None:
        """Clear authentication tokens."""
        self._access_token = None
        self._refresh_token = None

    @property
    def headers(self) -> dict[str, str]:
        """Build default headers for API requests."""
        h = {
            "apikey": self.config.anon_key,
            "Content-Type": "application/json",
        }
        if self._access_token:
            h["Authorization"] = f"Bearer {self._access_token}"
        return h

    @property
    def is_authenticated(self) -> bool:
        return self._access_token is not None
