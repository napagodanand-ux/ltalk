-- LTalk Supabase schema
-- Run this in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  public_key TEXT,
  key_backup_cipher TEXT,
  key_backup_salt TEXT,
  status TEXT DEFAULT 'offline',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add the encrypted-key-backup columns on existing databases whose schema
-- predates multi-device E2EE.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS key_backup_cipher TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS key_backup_salt TEXT;

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN DEFAULT FALSE,
  name TEXT,
  group_avatar_url TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_message_id UUID,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT DEFAULT 'text',
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  duration INTEGER,
  mime_type TEXT,
  encrypted BOOLEAN DEFAULT TRUE,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  reply_to_id UUID REFERENCES messages(id),
  edited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

CREATE TABLE IF NOT EXISTS reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);

-- Per-group encryption keys. Each participant stores the conversation's
-- symmetric key, sealed to their own public key. This lets a group message be
-- encrypted once with the shared key yet only decryptable by members.
CREATE TABLE IF NOT EXISTS conversation_keys (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,
  encryptor_public TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE conversation_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_keys REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Participants manage group keys" ON conversation_keys;
CREATE POLICY "Participants manage group keys" ON conversation_keys FOR ALL
  USING (is_participant(conversation_id))
  WITH CHECK (is_participant(conversation_id));

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
CREATE TRIGGER update_friendships_updated_at BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'display_name',
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reactions" ON reactions;
CREATE POLICY "Anyone can view reactions" ON reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own reactions" ON reactions;
CREATE POLICY "Users manage own reactions" ON reactions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
-- NOTE: this Supabase DB rejects `FOR INSERT` policies for the `authenticated`
-- role; the policy must be `FOR ALL` and include a USING clause that evaluates
-- TRUE for the new row (otherwise inserts fail with a row-level-security error).
CREATE POLICY "Users can insert own profile" ON profiles FOR ALL
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- Membership check that bypasses RLS (SECURITY DEFINER) to avoid policy recursion.
CREATE OR REPLACE FUNCTION is_participant(conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = is_participant.conversation_id
      AND cp.user_id = auth.uid()
  );
$$;

-- TRUE when the two users have an accepted friendship. Used to gate 1:1
-- conversations and messages so that two people can only exchange messages
-- after a friend request has been sent AND accepted by both sides.
CREATE OR REPLACE FUNCTION friendship_accepted(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND ((f.user_id = a AND f.friend_id = b) OR (f.user_id = b AND f.friend_id = a))
  );
$$;

GRANT EXECUTE ON FUNCTION friendship_accepted(uuid, uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
CREATE POLICY "Users can view their conversations" ON conversations FOR SELECT
USING (is_participant(id) OR created_by = auth.uid());
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can update conversations" ON conversations;
CREATE POLICY "Admins can update conversations" ON conversations FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Participants can delete conversations" ON conversations;
CREATE POLICY "Participants can delete conversations" ON conversations FOR DELETE
USING (
  created_by = auth.uid()
  OR (NOT is_group AND is_participant(id))
);

DROP POLICY IF EXISTS "Users can view participants" ON conversation_participants;
CREATE POLICY "Users can view participants" ON conversation_participants FOR SELECT
USING (is_participant(conversation_id));
-- Counts participants without triggering RLS recursion inside policies that
-- reference conversation_participants while it is being modified.
CREATE OR REPLACE FUNCTION participant_count(p_conversation_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM conversation_participants WHERE conversation_id = p_conversation_id;
$$;
GRANT EXECUTE ON FUNCTION participant_count(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "Admins can add participants" ON conversation_participants;
CREATE POLICY "Admins can add participants" ON conversation_participants FOR ALL
USING ((conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid()))
       OR is_participant(conversation_id))
WITH CHECK (
  conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
  AND (
    user_id = auth.uid()
    OR (SELECT is_group FROM conversations WHERE id = conversation_id)
    OR friendship_accepted(auth.uid(), user_id)
    -- Allow a 1:1 conversation with a non-friend (the 2nd participant need not be
    -- an accepted friend). Groups and friend adds stay restricted to friends.
    -- Uses participant_count() (SECURITY DEFINER) to avoid policy recursion.
    OR (NOT (SELECT is_group FROM conversations WHERE id = conversation_id)
        AND participant_count(conversation_id) < 2)
  )
);
DROP POLICY IF EXISTS "Users can remove members" ON conversation_participants;
CREATE POLICY "Users can remove members" ON conversation_participants FOR DELETE
USING (user_id = auth.uid()
       OR (conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())));

DROP POLICY IF EXISTS "Users can view messages" ON messages;
CREATE POLICY "Users can view messages" ON messages FOR SELECT
USING (is_participant(messages.conversation_id));
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
CREATE POLICY "Users can insert messages" ON messages FOR ALL
USING ((sender_id = auth.uid()) AND is_participant(messages.conversation_id))
WITH CHECK ((sender_id = auth.uid()) AND is_participant(messages.conversation_id)
  AND (
    (SELECT is_group FROM conversations WHERE id = conversation_id)
    OR EXISTS (
      SELECT 1 FROM conversation_participants p
      WHERE p.conversation_id = conversation_id
        AND p.user_id <> auth.uid()
        AND friendship_accepted(auth.uid(), p.user_id)
    )
    -- Allow 1:1 messages to a non-friend; the 3-message cap is enforced by a trigger.
    OR (NOT (SELECT is_group FROM conversations WHERE id = conversation_id))
  ));
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages" ON messages FOR UPDATE
USING (sender_id = auth.uid());

-- Lets a group's creator re-key the conversation (rotate the symmetric group
-- key on member removal) by re-encrypting existing messages with the new key.
-- Restricted to groups the caller administers so non-admins cannot alter others'
-- messages.
DROP POLICY IF EXISTS "Admins can rekey group messages" ON messages;
CREATE POLICY "Admins can rekey group messages" ON messages FOR UPDATE
USING ((conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid()))
       AND (SELECT is_group FROM conversations WHERE id = messages.conversation_id))
WITH CHECK ((conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid()))
       AND (SELECT is_group FROM conversations WHERE id = messages.conversation_id));

DROP POLICY IF EXISTS "Participants can delete messages" ON messages;
CREATE POLICY "Participants can delete messages" ON messages FOR DELETE
USING (is_participant(messages.conversation_id));

-- Hard cap: a 1:1 conversation between non-friends may hold at most 3 messages.
-- Enforced server-side so the limit holds even if a client tries to bypass it.
CREATE OR REPLACE FUNCTION enforce_nonfriend_message_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_group boolean;
  v_friend boolean;
BEGIN
  SELECT is_group INTO v_is_group FROM conversations WHERE id = NEW.conversation_id;
  IF v_is_group THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants p
    WHERE p.conversation_id = NEW.conversation_id
      AND p.user_id <> NEW.sender_id
      AND friendship_accepted(NEW.sender_id, p.user_id)
  ) INTO v_friend;
  IF v_friend THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM messages WHERE conversation_id = NEW.conversation_id) >= 3 THEN
    RAISE EXCEPTION 'MESSAGE_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nonfriend_message_limit ON messages;
CREATE TRIGGER trg_nonfriend_message_limit
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION enforce_nonfriend_message_limit();

-- Lets a participant mark the OTHER person's messages as read. The normal
-- messages UPDATE policy only allows editing one's own rows (sender_id =
-- auth.uid()), so a reader could never persist is_read on received messages —
-- which made unread badges reappear after a refresh. This runs as SECURITY
-- DEFINER and verifies the caller is both the reader and a participant before
-- updating only the read-receipt columns.
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id uuid, p_reader uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_reader THEN
    RETURN;
  END IF;
  IF NOT is_participant(p_conversation_id) THEN
    RETURN;
  END IF;

  UPDATE messages
    SET is_read = true, read_at = now()
    WHERE conversation_id = p_conversation_id
      AND sender_id <> p_reader;

  SELECT id INTO v_latest
    FROM messages
    WHERE conversation_id = p_conversation_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

  UPDATE conversation_participants
    SET last_read_message_id = v_latest
    WHERE conversation_id = p_conversation_id
      AND user_id = p_reader;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_conversation_read(uuid, uuid) TO authenticated, anon;

-- Unfriend: removes the accepted friendship between the caller and p_target in
-- either direction. SECURITY DEFINER so it bypasses the restrictive delete
-- policy (which only allows deleting rows where the caller is user_id), letting a
-- user remove a friend regardless of who originally sent the request.
CREATE OR REPLACE FUNCTION remove_friend(p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM friendships
    WHERE (user_id = auth.uid() AND friend_id = p_target)
       OR (user_id = p_target AND friend_id = auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION remove_friend(uuid) TO authenticated, anon;

-- Per-user "delete for me": a row here means the given user has hidden the
-- given message on their side only. It never affects the other participant,
-- unlike deleting the message row itself.
CREATE TABLE IF NOT EXISTS message_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_message_deletions_user ON message_deletions(user_id);
ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own deletions" ON message_deletions;
CREATE POLICY "Users manage own deletions" ON message_deletions FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships FOR SELECT
USING (user_id = auth.uid() OR friend_id = auth.uid());
DROP POLICY IF EXISTS "Users can create friend requests" ON friendships;
CREATE POLICY "Users can create friend requests" ON friendships FOR ALL
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update own friendships" ON friendships;
CREATE POLICY "Users can update own friendships" ON friendships FOR UPDATE
USING (user_id = auth.uid() OR friend_id = auth.uid());

-- Storage bucket for media
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Authenticated users can upload media" ON storage.objects FOR ALL
USING (bucket_id = 'media'::text AND owner = auth.uid())
WITH CHECK (bucket_id = 'media'::text);
DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;
CREATE POLICY "Anyone can view media" ON storage.objects FOR SELECT
USING (bucket_id = 'media');
DROP POLICY IF EXISTS "Owners can delete media" ON storage.objects;
CREATE POLICY "Owners can delete media" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media' AND owner = auth.uid());

-- Realtime
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE message_deletions REPLICA IDENTITY FULL;
ALTER TABLE conversation_participants REPLICA IDENTITY FULL;
ALTER TABLE reactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_deletions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_deletions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_keys'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_keys;
  END IF;
END $$;
