"""Structured logging configuration for LTalk."""

from __future__ import annotations

import logging
import sys
from typing import Any


class ContextFilter(logging.Filter):
    """Inject contextual fields into log records."""

    def __init__(self) -> None:
        super().__init__()
        self._context: dict[str, Any] = {}

    def set_context(self, **kwargs: Any) -> None:
        self._context.update(kwargs)

    def clear_context(self) -> None:
        self._context.clear()

    def filter(self, record: logging.LogRecord) -> bool:
        for key, value in self._context.items():
            setattr(record, key, value)
        # Ensure extra fields have defaults for format string
        record.user_id = getattr(record, "user_id", "")
        record.chat_id = getattr(record, "chat_id", "")
        return True


_context_filter = ContextFilter()


class StructuredFormatter(logging.Formatter):
    """Formatter with structured fields."""

    FMT = "%(asctime)s [%(levelname)-5s] %(name)s: %(message)s"
    DATE_FMT = "%Y-%m-%d %H:%M:%S"

    def __init__(self) -> None:
        super().__init__(fmt=self.FMT, datefmt=self.DATE_FMT)


def setup_logging(level: str = "INFO") -> ContextFilter:
    """Configure structured logging for the application.

    Returns the ContextFilter so callers can inject context:
        context_filter.set_context(user_id="abc", chat_id="123")
    """
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(StructuredFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.addFilter(_context_filter)

    # Quieten noisy libraries
    for name in ("httpx", "httpcore", "websockets", "supabase", "asyncio"):
        logging.getLogger(name).setLevel(logging.WARNING)

    return _context_filter


def get_context_filter() -> ContextFilter:
    """Get the global context filter."""
    return _context_filter
