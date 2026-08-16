"""Contract tests for the Supabase schema.

These are static checks that keep the RLS lockdown and the
chat_summaries view from silently regressing. Full behavioral tests
require a live Supabase project and live in the integration suite.
"""

from __future__ import annotations

from pathlib import Path

SQL_PATH = Path(__file__).resolve().parent.parent / "supabase_schema.sql"


def _sql() -> str:
    return SQL_PATH.read_text(encoding="utf-8")


class TestRlsLockdown:
    def test_all_tables_enable_rls(self):
        sql = _sql()
        for table in [
            "profiles", "key_bundles", "chats", "chat_members", "messages",
            "message_status", "statuses", "status_views", "calls",
            "blocked_users", "contacts",
        ]:
            assert f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY" in sql

    def test_chats_delete_policy_restricted_to_creator_or_admin(self):
        sql = _sql()
        assert 'CREATE POLICY "chats_delete"' in sql
        assert "created_by = auth.uid()" in sql
        assert "group_admin_id = auth.uid()" in sql

    def test_message_status_scoped_to_chat_membership(self):
        sql = _sql()
        assert "chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid())" in sql

    def test_messages_insert_requires_membership(self):
        sql = _sql()
        assert 'CREATE POLICY "messages_insert"' in sql
        assert "sender_id = auth.uid()" in sql
        assert "chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid())" in sql

    def test_chat_members_insert_no_self_join(self):
        sql = _sql()
        assert 'CREATE POLICY "chat_members_insert"' in sql
        assert "created_by = auth.uid()" in sql
        assert "group_admin_id = auth.uid()" in sql

    def test_calls_scoped_to_membership(self):
        sql = _sql()
        assert 'CREATE POLICY "calls_select"' in sql
        assert 'CREATE POLICY "calls_insert"' in sql
        assert "caller_id = auth.uid()" in sql


class TestChatSummariesView:
    def test_view_exists(self):
        assert "CREATE OR REPLACE VIEW public.chat_summaries" in _sql()

    def test_view_is_security_invoker(self):
        assert "security_invoker = true" in _sql()

    def test_view_exposes_epoch_timestamps(self):
        sql = _sql()
        assert "extract(epoch FROM c.created_at)::bigint" in sql
        assert "extract(epoch FROM c.updated_at)::bigint" in sql

    def test_view_aggregates_members(self):
        sql = _sql()
        assert "jsonb_agg" in sql
        assert "display_name" in sql
        assert "role" in sql


class TestSchemaIntegrity:
    def test_created_by_column_present(self):
        sql = _sql()
        assert "created_by UUID REFERENCES public.profiles(id)" in sql

    def test_no_service_role_in_schema(self):
        # The anon key is the only client credential; the schema must
        # never assume a service-role key exists.
        assert "service_role" not in _sql().lower()
