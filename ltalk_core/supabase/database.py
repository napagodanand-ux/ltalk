"""Supabase Database (PostgREST) query operations."""

from __future__ import annotations

from typing import Any, Optional

from .client import SupabaseClient


class SupabaseDatabase:
    """Handles Supabase database CRUD via PostgREST."""

    def __init__(self, client: SupabaseClient) -> None:
        self.client = client

    async def select(
        self,
        table: str,
        columns: str = "*",
        filters: Optional[dict[str, Any]] = None,
        order: Optional[str] = None,
        ascending: bool = True,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> list[dict]:
        """Query rows from a table."""
        params: dict[str, str] = {"select": columns}
        if filters:
            for key, value in filters.items():
                if isinstance(value, bool):
                    params[key] = f"eq.{'true' if value else 'false'}"
                elif isinstance(value, (int, float)):
                    params[key] = f"eq.{value}"
                else:
                    params[key] = f"eq.{value}"
        if order:
            direction = ".asc" if ascending else ".desc"
            params["order"] = f"{order}{direction}"
        if limit is not None:
            headers = {**self.client.headers, "Range": f"0-{limit - 1}"}
        else:
            headers = self.client.headers
        if offset is not None:
            range_header = f"{offset}-"
            if limit is not None:
                range_header = f"{offset}-{offset + limit - 1}"
            headers = {**headers, "Range": range_header}

        response = await self.client.http.get(
            f"/rest/v1/{table}",
            params=params,
            headers=headers,
        )
        response.raise_for_status()
        return response.json()

    async def insert(self, table: str, data: dict | list[dict]) -> list[dict]:
        """Insert one or more rows."""
        response = await self.client.http.post(
            f"/rest/v1/{table}",
            json=data,
            headers={**self.client.headers, "Prefer": "return=representation"},
        )
        response.raise_for_status()
        result = response.json()
        if isinstance(result, dict):
            return [result]
        return result

    async def update(
        self, table: str, data: dict, filters: dict[str, Any]
    ) -> list[dict]:
        """Update rows matching filters."""
        params: dict[str, str] = {}
        for key, value in filters.items():
            if isinstance(value, bool):
                params[key] = f"eq.{'true' if value else 'false'}"
            else:
                params[key] = f"eq.{value}"

        response = await self.client.http.patch(
            f"/rest/v1/{table}",
            json=data,
            params=params,
            headers={**self.client.headers, "Prefer": "return=representation"},
        )
        response.raise_for_status()
        result = response.json()
        if isinstance(result, dict):
            return [result]
        return result

    async def delete(self, table: str, filters: dict[str, Any]) -> None:
        """Delete rows matching filters."""
        params: dict[str, str] = {}
        for key, value in filters.items():
            if isinstance(value, bool):
                params[key] = f"eq.{'true' if value else 'false'}"
            else:
                params[key] = f"eq.{value}"

        response = await self.client.http.delete(
            f"/rest/v1/{table}",
            params=params,
            headers=self.client.headers,
        )
        response.raise_for_status()

    async def upsert(self, table: str, data: dict | list[dict]) -> list[dict]:
        """Insert or update rows (conflict resolution)."""
        response = await self.client.http.post(
            f"/rest/v1/{table}",
            json=data,
            headers={
                **self.client.headers,
                "Prefer": "return=representation,resolution=merge-duplicates",
            },
        )
        response.raise_for_status()
        result = response.json()
        if isinstance(result, dict):
            return [result]
        return result

    async def rpc(
        self, function_name: str, params: Optional[dict[str, Any]] = None
    ) -> Any:
        """Call a Supabase Edge Function (database function)."""
        response = await self.client.http.post(
            f"/rest/v1/rpc/{function_name}",
            json=params or {},
            headers=self.client.headers,
        )
        response.raise_for_status()
        return response.json()
