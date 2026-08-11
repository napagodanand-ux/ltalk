"""Supabase client integration."""

from .auth import SupabaseAuth
from .client import SupabaseClient, SupabaseConfig
from .database import SupabaseDatabase
from .realtime import SupabaseRealtime
from .storage import SupabaseStorage

__all__ = [
    "SupabaseAuth",
    "SupabaseClient",
    "SupabaseConfig",
    "SupabaseDatabase",
    "SupabaseRealtime",
    "SupabaseStorage",
]
