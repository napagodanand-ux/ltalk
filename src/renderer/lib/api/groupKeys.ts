import { supabase } from '../supabase';
import type { Profile } from '../../../../src/shared/types';
import {
  generateSymmetricKey,
  exportSymmetricKey,
  encryptMessage,
  decryptMessage,
  decodeKey,
  encodeKey,
  publicFromPrivate
} from '../encryption';
import { getPrivateKey } from '../keys';

function decodePublic(b64: string | null): JsonWebKey | null {
  if (!b64) return null;
  try {
    return decodeKey(b64);
  } catch {
    return null;
  }
}

// Generates a fresh symmetric key for a group and seals it to every member
// (including the creator) using their public key. Returns once all rows exist.
export async function setupGroupKeys(
  conversationId: string,
  memberIds: string[]
): Promise<void> {
  const myPrivate = getPrivateKey();
  if (!myPrivate) throw new Error('Encryption keys are not ready');
  const myPublicB64 = encodeKey(publicFromPrivate(myPrivate));

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, public_key')
    .in('id', memberIds);
  if (error) throw new Error(error.message);

  const symKey = await generateSymmetricKey();
  const raw = await exportSymmetricKey(symKey);

  const rows = (profiles as Pick<Profile, 'id' | 'public_key'>[])
    .map((p) => {
      const pub = decodePublic(p.public_key);
      if (!pub) return null;
      return { memberId: p.id, pub };
    })
    .filter((r): r is { memberId: string; pub: JsonWebKey } => r !== null)
    .map(async (r) => ({
      conversation_id: conversationId,
      user_id: r.memberId,
      encrypted_key: await encryptMessage(raw, myPrivate, r.pub),
      encryptor_public: myPublicB64
    }));

  const resolved = await Promise.all(rows);
  if (!resolved.length) throw new Error('No members with keys found');

  const { error: insertError } = await supabase.from('conversation_keys').insert(resolved);
  if (insertError) throw new Error(insertError.message);
}

// Adds new members to an existing group: seals the group's existing symmetric
// key (fetched from the caller's own row) to each newcomer's public key.
export async function addGroupMembers(
  conversationId: string,
  memberIds: string[]
): Promise<void> {
  const me = await supabase.auth.getUser();
  if (!me.data.user) throw new Error('Not authenticated');
  const myPrivate = getPrivateKey();
  if (!myPrivate) throw new Error('Encryption keys are not ready');
  const myPublicB64 = encodeKey(publicFromPrivate(myPrivate));

  const { data: mine, error: mineErr } = await supabase
    .from('conversation_keys')
    .select('encrypted_key, encryptor_public')
    .eq('conversation_id', conversationId)
    .eq('user_id', me.data.user.id)
    .single();
  if (mineErr || !mine) throw new Error('Could not read group key');

  const raw = await decryptMessage(
    (mine as { encrypted_key: string; encryptor_public: string }).encrypted_key,
    myPrivate,
    decodePublic((mine as { encrypted_key: string; encryptor_public: string }).encryptor_public)!
  );

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, public_key')
    .in('id', memberIds);
  if (error) throw new Error(error.message);

  const rows = (profiles as Pick<Profile, 'id' | 'public_key'>[])
    .map((p) => {
      const pub = decodePublic(p.public_key);
      if (!pub) return null;
      return { memberId: p.id, pub };
    })
    .filter((r): r is { memberId: string; pub: JsonWebKey } => r !== null)
    .map(async (r) => ({
      conversation_id: conversationId,
      user_id: r.memberId,
      encrypted_key: await encryptMessage(raw, myPrivate, r.pub),
      encryptor_public: myPublicB64
    }));

  const resolved = await Promise.all(rows);
  if (resolved.length) {
    const { error: insertError } = await supabase.from('conversation_keys').insert(resolved);
    if (insertError) throw new Error(insertError.message);
  }
}

export interface GroupKeyMaterial {
  encryptedKey: string;
  encryptorPublic: string;
}

// Fetches this user's sealed group key for a conversation.
export async function fetchMyGroupKey(conversationId: string): Promise<GroupKeyMaterial | null> {
  const me = await supabase.auth.getUser();
  if (!me.data.user) return null;
  const { data, error } = await supabase
    .from('conversation_keys')
    .select('encrypted_key, encryptor_public')
    .eq('conversation_id', conversationId)
    .eq('user_id', me.data.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    encryptedKey: (data as { encrypted_key: string }).encrypted_key,
    encryptorPublic: (data as { encryptor_public: string }).encryptor_public
  };
}
