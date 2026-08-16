"""Tests for the unified timestamp helper."""

from __future__ import annotations

import time
from datetime import UTC, datetime

import pytest

from ltalk_core.timestamps import to_epoch


class TestToEpoch:
    def test_none_returns_zero(self):
        assert to_epoch(None) == 0.0

    def test_numbers_pass_through(self):
        assert to_epoch(1234) == 1234.0
        assert to_epoch(1234.5) == 1234.5

    def test_epoch_string_parsed(self):
        assert to_epoch("1710000000") == 1710000000.0

    def test_iso_utc_string_parsed(self):
        expected = datetime(2024, 3, 9, 12, 0, tzinfo=UTC).timestamp()
        assert to_epoch("2024-03-09T12:00:00Z") == expected

    def test_iso_offset_string_parsed(self):
        expected = datetime(2024, 3, 9, 10, 0, tzinfo=UTC).timestamp()
        assert to_epoch("2024-03-09T12:00:00+02:00") == expected

    def test_datetime_object(self):
        dt = datetime(2024, 1, 1, tzinfo=UTC)
        assert to_epoch(dt) == dt.timestamp()

    def test_empty_string_returns_zero(self):
        assert to_epoch("") == 0.0
        assert to_epoch("   ") == 0.0

    def test_unsupported_type_raises(self):
        with pytest.raises(TypeError):
            to_epoch({"not": "a timestamp"})

    def test_round_trip_against_time(self):
        now = time.time()
        iso = datetime.fromtimestamp(now, tz=UTC).isoformat()
        assert abs(to_epoch(iso) - now) < 1.0
