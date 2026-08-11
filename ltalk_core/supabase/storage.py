"""Supabase Storage operations."""

from __future__ import annotations

from typing import Optional

from .client import SupabaseClient


class SupabaseStorage:
    """Handles Supabase Storage file operations."""

    def __init__(self, client: SupabaseClient) -> None:
        self.client = client

    async def upload_file(
        self,
        bucket: str,
        path: str,
        file_data: bytes,
        content_type: str = "application/octet-stream",
    ) -> dict:
        """Upload a file to a storage bucket."""
        response = await self.client.http.post(
            f"/storage/v1/object/{bucket}/{path}",
            content=file_data,
            headers={
                **self.client.headers,
                "Content-Type": content_type,
            },
        )
        response.raise_for_status()
        return response.json()

    async def download_file(self, bucket: str, path: str) -> bytes:
        """Download a file from a storage bucket."""
        response = await self.client.http.get(
            f"/storage/v1/object/{bucket}/{path}",
            headers=self.client.headers,
        )
        response.raise_for_status()
        return response.content

    async def delete_file(self, bucket: str, paths: list[str]) -> None:
        """Delete files from a storage bucket."""
        response = await self.client.http.delete(
            f"/storage/v1/object/{bucket}",
            json=paths,
            headers=self.client.headers,
        )
        response.raise_for_status()

    async def get_public_url(self, bucket: str, path: str) -> str:
        """Get the public URL for a file (public buckets only)."""
        return f"{self.client.config.url}/storage/v1/object/public/{bucket}/{path}"

    async def create_signed_url(
        self, bucket: str, path: str, expires_in: int = 3600
    ) -> str:
        """Create a signed URL for private bucket access."""
        response = await self.client.http.post(
            f"/storage/v1/object/sign/{bucket}/{path}",
            json={"expiresIn": expires_in},
            headers=self.client.headers,
        )
        response.raise_for_status()
        data = response.json()
        signed_url = data.get("signedURL", "")
        if signed_url and not signed_url.startswith("http"):
            signed_url = f"{self.client.config.url}{signed_url}"
        return signed_url

    async def list_files(
        self, bucket: str, path: str = "", limit: int = 100
    ) -> list[dict]:
        """List files in a storage bucket path."""
        response = await self.client.http.post(
            f"/storage/v1/object/list/{bucket}",
            json={"prefix": path, "limit": limit},
            headers=self.client.headers,
        )
        response.raise_for_status()
        return response.json()

    async def update_file(
        self,
        bucket: str,
        path: str,
        file_data: bytes,
        content_type: str = "application/octet-stream",
    ) -> dict:
        """Update (replace) a file in storage."""
        response = await self.client.http.put(
            f"/storage/v1/object/{bucket}/{path}",
            content=file_data,
            headers={
                **self.client.headers,
                "Content-Type": content_type,
            },
        )
        response.raise_for_status()
        return response.json()
