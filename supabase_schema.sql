-- LTalk Supabase Schema (Fixed RLS)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS public.status_views CASCADE;
DROP TABLE IF EXISTS public.statuses CASCADE;
DROP TABLE IF EXISTS public.message_status CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.calls CASCADE;
DROP TABLE IF EXISTS public.blocked_users CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.chat_members CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.key_bundles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  about TEXT DEFAULT '',
  avatar_url TEXT,
  last_seen TIMESTAMPTZ DEFAULT now(),
  online BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- E2EE Key Bundles
CREATE TABLE public.key_bundles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  identity_key TEXT NOT NULL,
  signed_pre_key_id INTEGER NOT NULL,
  signed_pre_key TEXT NOT NULL,
  signed_pre_key_signature TEXT NOT NULL,
  one_time_pre_keys JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chats
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN DEFAULT false,
  group_name TEXT,
  group_avatar_url TEXT,
  group_admin_id UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat Members
CREATE TABLE public.chat_members (
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id),
  message_type TEXT NOT NULL,
  encrypted_content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  reply_to UUID REFERENCES public.messages(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_for_everyone BOOLEAN DEFAULT false,
  disappearing_until TIMESTAMPTZ
);

-- Message Status
CREATE TABLE public.message_status (
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id UUID,
  status TEXT DEFAULT 'sent',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Statuses
CREATE TABLE public.statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status_type TEXT NOT NULL,
  encrypted_content TEXT NOT NULL,
  background_color TEXT DEFAULT '#A52A2A',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  privacy TEXT DEFAULT 'contacts',
  privacy_data JSONB DEFAULT '[]'
);

-- Status Views
CREATE TABLE public.status_views (
  status_id UUID REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);

-- Calls
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID REFERENCES public.profiles(id),
  chat_id UUID REFERENCES public.chats(id),
  call_type TEXT NOT NULL,
  status TEXT DEFAULT 'initiated',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  participants JSONB DEFAULT '[]'
);

-- Blocked Users
CREATE TABLE public.blocked_users (
  blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Contacts
CREATE TABLE public.contacts (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_name_override TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, contact_id)
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES (No recursion)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.key_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "key_bundles_select" ON public.key_bundles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "key_bundles_insert" ON public.key_bundles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "key_bundles_update" ON public.key_bundles FOR UPDATE USING (auth.uid() = user_id);

-- Chat policies: users can only access chats they are members of
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chats_select" ON public.chats FOR SELECT
  USING (id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid()));
CREATE POLICY "chats_insert" ON public.chats FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "chats_update" ON public.chats FOR UPDATE
  USING (id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid()));
-- Only the chat creator (or the admin of a group) may delete a chat
CREATE POLICY "chats_delete" ON public.chats FOR DELETE
  USING (created_by = auth.uid() OR (is_group AND group_admin_id = auth.uid()));

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_members_select" ON public.chat_members FOR SELECT
  USING (chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid()));
-- Members can only be added by the chat creator or a group admin; no self-join
CREATE POLICY "chat_members_insert" ON public.chat_members FOR INSERT WITH CHECK (
  chat_id IN (SELECT id FROM chats WHERE created_by = auth.uid() OR (is_group AND group_admin_id = auth.uid()))
);
-- Leave a chat yourself, or be removed by the creator/group admin
CREATE POLICY "chat_members_delete" ON public.chat_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR chat_id IN (SELECT id FROM chats WHERE created_by = auth.uid() OR (is_group AND group_admin_id = auth.uid()))
  );

-- Message policies: users can only access messages in chats they are members of
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid()));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid())
);
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (
  sender_id = auth.uid()
  AND chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid())
);

-- Message status is chat-scoped, not globally readable
ALTER TABLE public.message_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "message_status_select" ON public.message_status FOR SELECT
  USING (chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid()));
CREATE POLICY "message_status_insert" ON public.message_status FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid())
);
CREATE POLICY "message_status_update" ON public.message_status FOR UPDATE USING (
  user_id = auth.uid()
  AND chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid())
);
CREATE POLICY "message_status_delete" ON public.message_status FOR DELETE
  USING (user_id = auth.uid());

ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "statuses_select" ON public.statuses FOR SELECT USING (
    auth.uid() = user_id
    OR user_id IN (
        SELECT contact_id FROM contacts WHERE user_id = auth.uid()
    )
);
CREATE POLICY "statuses_insert" ON public.statuses FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_views_select" ON public.status_views FOR SELECT USING (auth.uid() = viewer_id);
CREATE POLICY "status_views_insert" ON public.status_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls_select" ON public.calls FOR SELECT
  USING (chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid()));
CREATE POLICY "calls_insert" ON public.calls FOR INSERT WITH CHECK (
  caller_id = auth.uid()
  AND chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid())
);
CREATE POLICY "calls_delete" ON public.calls FOR DELETE
  USING (chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid()));

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_users_select" ON public.blocked_users FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_insert" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_delete" ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_messages_chat_time ON public.messages(chat_id, created_at);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_chat_members_user ON public.chat_members(user_id);
CREATE INDEX idx_profiles_display_name ON public.profiles(display_name);

-- Last-seen is maintained server-side so clients only send online/offline state
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_touch_last_seen
BEFORE UPDATE OF online ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_last_seen();

-- ============================================
-- Chat summaries: one query for the whole chat list
-- ============================================
-- security_invoker makes the view run with the caller's RLS, so
-- the member-scoped chats/messages/chat_members policies apply.
-- Timestamps are returned as epoch seconds (bigint) so clients can
-- store them without ISO-8601 parsing.
CREATE OR REPLACE VIEW public.chat_summaries AS
SELECT
  c.id,
  c.is_group,
  c.group_name,
  c.group_avatar_url,
  c.group_admin_id,
  c.created_by,
  extract(epoch FROM c.created_at)::bigint AS created_at,
  extract(epoch FROM c.updated_at)::bigint AS updated_at,
  COALESCE(
    (SELECT extract(epoch FROM max(m.created_at))::bigint
       FROM public.messages m WHERE m.chat_id = c.id),
    extract(epoch FROM c.created_at)::bigint
  ) AS last_message_at,
  (SELECT m.encrypted_content FROM public.messages m
    WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_preview,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'user_id', cm.user_id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'role', cm.role,
        'joined_at', extract(epoch FROM cm.joined_at)::bigint
      ) ORDER BY cm.joined_at
    )
    FROM public.chat_members cm
    LEFT JOIN public.profiles p ON p.id = cm.user_id
    WHERE cm.chat_id = c.id
  ), '[]'::jsonb) AS members
FROM public.chats c;

ALTER VIEW public.chat_summaries SET (security_invoker = true);
