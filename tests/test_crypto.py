"""Tests for the crypto/E2EE module."""

from __future__ import annotations

import os

import pytest

from ltalk_core.crypto.session_cache import SessionCache
from ltalk_core.crypto.signal_manager import SignalManager
from tests.conftest import MockDb


class TestSessionCache:
    """Tests for the in-memory session cache."""

    def test_put_and_get(self):
        cache = SessionCache(max_size=10)
        cache.put("user1", b"session_data")
        assert cache.get("user1") == b"session_data"

    def test_get_nonexistent(self):
        cache = SessionCache()
        assert cache.get("nonexistent") is None

    def test_lru_eviction(self):
        cache = SessionCache(max_size=2)
        cache.put("user1", b"data1")
        cache.put("user2", b"data2")
        cache.put("user3", b"data3")  # Should evict user1
        assert cache.get("user1") is None
        assert cache.get("user2") == b"data2"
        assert cache.get("user3") == b"data3"

    def test_lru_access_refreshes(self):
        cache = SessionCache(max_size=2)
        cache.put("user1", b"data1")
        cache.put("user2", b"data2")
        cache.get("user1")  # Access user1, should move to end
        cache.put("user3", b"data3")  # Should evict user2
        assert cache.get("user1") == b"data1"
        assert cache.get("user2") is None

    def test_remove(self):
        cache = SessionCache()
        cache.put("user1", b"data1")
        cache.remove("user1")
        assert cache.get("user1") is None

    def test_clear(self):
        cache = SessionCache()
        cache.put("user1", b"data1")
        cache.put("user2", b"data2")
        cache.clear()
        assert cache.size == 0

    def test_size(self):
        cache = SessionCache()
        assert cache.size == 0
        cache.put("user1", b"data1")
        assert cache.size == 1
        cache.put("user2", b"data2")
        assert cache.size == 2


class TestSignalManager:
    """Tests for the Signal Protocol manager."""

    def test_generate_identity_key_pair(self, signal_manager: SignalManager):
        private_key, public_key = signal_manager.generate_identity_key_pair()
        assert len(private_key) > 0
        assert len(public_key) > 0

    def test_generate_pre_keys(self, signal_manager: SignalManager):
        keys = signal_manager.generate_pre_keys(1, 5)
        assert len(keys) == 5
        for key in keys:
            assert "id" in key
            assert "public_key" in key
            assert "private_key" in key

    def test_generate_signed_pre_key(self, signal_manager: SignalManager):
        private_key = os.urandom(32)
        public_key = os.urandom(33)
        signed_pre_key = signal_manager.generate_signed_pre_key((private_key, public_key))
        assert "id" in signed_pre_key
        assert "public_key" in signed_pre_key
        assert "private_key" in signed_pre_key
        assert "signature" in signed_pre_key

    def test_encrypt_decrypt_fallback_raises(self, signal_manager: SignalManager):
        """Without libsignal, encrypt/decrypt should raise RuntimeError."""
        session_record = os.urandom(32)
        plaintext = b"Hello, LTalk!"
        with pytest.raises(RuntimeError, match="libsignal is required"):
            signal_manager.encrypt(session_record, plaintext)

    def test_establish_session_fallback_raises(self, signal_manager: SignalManager):
        """Without libsignal, establish_session should raise RuntimeError."""
        with pytest.raises(RuntimeError, match="libsignal is required"):
            signal_manager.establish_session({"identity_key": "aa", "signed_pre_key": "bb"})
