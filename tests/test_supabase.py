"""Tests for the Supabase client integration."""

import pytest

from ltalk_core.supabase.client import SupabaseClient, SupabaseConfig


class TestSupabaseConfig:
    """Tests for Supabase configuration."""

    def test_api_url(self):
        config = SupabaseConfig(url="https://abc.supabase.co", anon_key="key")
        assert config.api_url == "https://abc.supabase.co/rest/v1"

    def test_auth_url(self):
        config = SupabaseConfig(url="https://abc.supabase.co", anon_key="key")
        assert config.auth_url == "https://abc.supabase.co/auth/v1"

    def test_realtime_url(self):
        config = SupabaseConfig(url="https://abc.supabase.co", anon_key="key")
        assert config.realtime_url == "wss://abc.supabase.co/realtime/v1/websocket"

    def test_storage_url(self):
        config = SupabaseConfig(url="https://abc.supabase.co", anon_key="key")
        assert config.storage_url == "https://abc.supabase.co/storage/v1"

    def test_functions_url(self):
        config = SupabaseConfig(url="https://abc.supabase.co", anon_key="key")
        assert config.functions_url == "https://abc.supabase.co/functions/v1"

    def test_trailing_slash_handling(self):
        config = SupabaseConfig(url="https://abc.supabase.co/", anon_key="key")
        assert config.api_url == "https://abc.supabase.co/rest/v1"


class TestSupabaseClient:
    """Tests for the Supabase client."""

    def test_set_tokens(self):
        config = SupabaseConfig(url="https://abc.supabase.co", anon_key="key")
        client = SupabaseClient(config)
        client.set_tokens("jwt-123", "refresh-456")
        assert client.is_authenticated is True
        assert "Bearer jwt-123" in client.headers.get("Authorization", "")

    def test_clear_tokens(self):
        config = SupabaseConfig(url="https://abc.supabase.co", anon_key="key")
        client = SupabaseClient(config)
        client.set_tokens("jwt-123")
        client.clear_tokens()
        assert client.is_authenticated is False

    def test_headers_without_auth(self):
        config = SupabaseConfig(url="https://abc.supabase.co", anon_key="test-key")
        client = SupabaseClient(config)
        headers = client.headers
        assert headers["apikey"] == "test-key"
        assert "Authorization" not in headers

    def test_headers_with_auth(self):
        config = SupabaseConfig(url="https://abc.supabase.co", anon_key="test-key")
        client = SupabaseClient(config)
        client.set_tokens("my-jwt")
        headers = client.headers
        assert headers["Authorization"] == "Bearer my-jwt"
