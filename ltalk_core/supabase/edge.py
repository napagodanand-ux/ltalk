"""Supabase Edge Functions invocations."""

from __future__ import annotations

from typing import Any, Optional

from .client import SupabaseClient


class SupabaseEdge:
    """Invokes Supabase Edge Functions."""

    def __init__(self, client: SupabaseClient) -> None:
        self.client = client

    async def invoke_function(
        self,
        function_name: str,
        method: str = "POST",
        body: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Any:
        """Invoke an Edge Function."""
        url = f"/functions/v1/{function_name}"
        request_headers = {**self.client.headers}
        if headers:
            request_headers.update(headers)

        if method.upper() == "GET":
            response = await self.client.http.get(url, headers=request_headers)
        elif method.upper() == "POST":
            response = await self.client.http.post(
                url, json=body or {}, headers=request_headers
            )
        elif method.upper() == "PUT":
            response = await self.client.http.put(
                url, json=body or {}, headers=request_headers
            )
        elif method.upper() == "DELETE":
            response = await self.client.http.delete(url, headers=request_headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        response.raise_for_status()
        return response.json()

    async def cleanup_expired_statuses(self) -> dict:
        """Trigger cleanup of expired statuses."""
        return await self.invoke_function("cleanup-expired-statuses")

    async def call_signaling(self, payload: dict) -> dict:
        """Send call signaling data."""
        return await self.invoke_function("call-signaling", body=payload)
