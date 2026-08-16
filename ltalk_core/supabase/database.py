"""Supabase Database (PostgREST) query operations."""

from __future__ import annotations

from typing import Any, Optional

from .client import SupabaseClient


class SupabaseDatabase:
    """Handles Supabase database CRUD via PostgREST."""

    POSTGREST_OPERATORS = frozenset({
        "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is",
        "isnot", "contains", "containedby", "overlaps", "not", "match",
        "imatch", "fts", "plfts", "phfts", "wfts", "cs", "cd", "ov",
        "sl", "sr", "nxr", "nxl", "adj", "or", "and",
    })

    def __init__(self, client: SupabaseClient) -> None:
        self.client = client

    @staticmethod
    def _prepare_param(key: str, value: Any) -> str:
        """Build a PostgREST filter param from a bare value or an already-prefixed one."""
        if isinstance(value, bool):
            return "eq.true" if value else "eq.false"
        if isinstance(value, (int, float)):
            return f"eq.{value}"
        if isinstance(value, str):
            op, dot, _ = value.partition(".")
            if dot and op.lower() in SupabaseDatabase.POSTGREST_OPERATORS:
                return value
            return f"eq.{value}"
        return f"eq.{value}"

    @staticmethod
    def _build_filters(filters: Optional[dict[str, Any]]) -> dict[str, str]:
        if not filters:
            return {}
        return {
            key: SupabaseDatabase._prepare_param(key, value)
            for key, value in filters.items()
        }

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
        params.update(self._build_filters(filters))
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
        params = self._build_filters(filters)

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
        params = self._build_filters(filters)

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
