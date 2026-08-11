"""Tests for input validation."""

from __future__ import annotations

import os
import tempfile

import pytest

from ltalk_core.exceptions import ValidationError
from ltalk_core.validation import (
    validate_display_name,
    validate_email,
    validate_file_path,
    validate_file_type,
    validate_message_content,
    validate_password,
    validate_query,
    validate_uuid,
)


class TestValidateEmail:
    def test_valid_email(self):
        assert validate_email("user@example.com") == "user@example.com"

    def test_strips_whitespace(self):
        assert validate_email("  user@example.com  ") == "user@example.com"

    def test_lowercases(self):
        assert validate_email("User@Example.COM") == "user@example.com"

    def test_empty_raises(self):
        with pytest.raises(ValidationError, match="required"):
            validate_email("")

    def test_whitespace_only_raises(self):
        with pytest.raises(ValidationError, match="required"):
            validate_email("   ")

    def test_no_at_raises(self):
        with pytest.raises(ValidationError, match="Invalid email"):
            validate_email("userexample.com")

    def test_no_domain_raises(self):
        with pytest.raises(ValidationError, match="Invalid email"):
            validate_email("user@")

    def test_too_long_raises(self):
        with pytest.raises(ValidationError, match="too long"):
            validate_email("a" * 250 + "@example.com")


class TestValidatePassword:
    def test_valid_password(self):
        assert validate_password("securepass1") == "securepass1"

    def test_empty_raises(self):
        with pytest.raises(ValidationError, match="required"):
            validate_password("")

    def test_too_short_raises(self):
        with pytest.raises(ValidationError, match="at least"):
            validate_password("short")

    def test_too_long_raises(self):
        with pytest.raises(ValidationError, match="too long"):
            validate_password("a" * 200)


class TestValidateDisplayName:
    def test_valid_name(self):
        assert validate_display_name("Alice") == "Alice"

    def test_strips_whitespace(self):
        assert validate_display_name("  Alice  ") == "Alice"

    def test_empty_raises(self):
        with pytest.raises(ValidationError, match="required"):
            validate_display_name("")

    def test_too_long_raises(self):
        with pytest.raises(ValidationError, match="too long"):
            validate_display_name("A" * 100)


class TestValidateMessageContent:
    def test_valid_content(self):
        assert validate_message_content("Hello!") == "Hello!"

    def test_strips_whitespace(self):
        assert validate_message_content("  Hello!  ") == "Hello!"

    def test_empty_raises(self):
        with pytest.raises(ValidationError, match="empty"):
            validate_message_content("")

    def test_whitespace_only_raises(self):
        with pytest.raises(ValidationError, match="empty"):
            validate_message_content("   ")

    def test_too_long_raises(self):
        with pytest.raises(ValidationError, match="too long"):
            validate_message_content("a" * 20000)


class TestValidateQuery:
    def test_valid_query(self):
        assert validate_query("test") == "test"

    def test_empty_raises(self):
        with pytest.raises(ValidationError, match="empty"):
            validate_query("")

    def test_too_long_raises(self):
        with pytest.raises(ValidationError, match="too long"):
            validate_query("a" * 100)


class TestValidateUuid:
    def test_valid_uuid(self):
        assert validate_uuid("550e8400-e29b-41d4-a716-446655440000") == "550e8400-e29b-41d4-a716-446655440000"

    def test_uppercase_accepted(self):
        assert validate_uuid("550E8400-E29B-41D4-A716-446655440000") == "550E8400-E29B-41D4-A716-446655440000"

    def test_invalid_format_raises(self):
        with pytest.raises(ValidationError, match="Invalid"):
            validate_uuid("not-a-uuid")

    def test_empty_raises(self):
        with pytest.raises(ValidationError, match="Invalid"):
            validate_uuid("")


class TestValidateFilePath:
    def test_existing_file(self, tmp_path):
        f = tmp_path / "test.txt"
        f.write_text("hello")
        assert validate_file_path(str(f)) == str(f)

    def test_nonexistent_raises(self):
        with pytest.raises(ValidationError, match="does not exist"):
            validate_file_path("/nonexistent/file.txt")

    def test_empty_raises(self):
        with pytest.raises(ValidationError, match="required"):
            validate_file_path("")

    def test_traversal_raises(self):
        with pytest.raises(ValidationError, match="traversal"):
            validate_file_path("/tmp/../../../etc/passwd")

    def test_too_large_raises(self, tmp_path):
        f = tmp_path / "large.bin"
        f.write_bytes(b"x" * (101 * 1024 * 1024))  # 101 MB
        with pytest.raises(ValidationError, match="too large"):
            validate_file_path(str(f))


class TestValidateFileType:
    def test_valid_image(self, tmp_path):
        f = tmp_path / "photo.png"
        f.write_bytes(b"\x89PNG")
        assert validate_file_type(str(f), "image") == str(f)

    def test_invalid_image_type(self, tmp_path):
        f = tmp_path / "file.exe"
        f.write_bytes(b"MZ")
        with pytest.raises(ValidationError, match="Invalid image"):
            validate_file_type(str(f), "image")

    def test_valid_document(self, tmp_path):
        f = tmp_path / "doc.pdf"
        f.write_bytes(b"%PDF")
        assert validate_file_type(str(f), "document") == str(f)

    def test_invalid_document_type(self, tmp_path):
        f = tmp_path / "image.png"
        f.write_bytes(b"\x89PNG")
        with pytest.raises(ValidationError, match="Invalid document"):
            validate_file_type(str(f), "document")
