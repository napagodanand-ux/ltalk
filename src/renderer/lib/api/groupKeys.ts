import { supabase } from '../supabase';
import type { Profile } from '../../../../src/shared/types';
import {
  generateSymmetricKey,
  exportSymmetricKey,
  importSymmetricKey,
  encryptMessage,
  decryptMessage,
  aesEncrypt,
  aesDecrypt,
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

// Rotates a group's symmetric key after a member is removed. Generates a fresh
// key, re-encrypts every existing encrypted message with it (so history stays
// readable for the remaining members under one key), re-seals the new key to
// each remaining member, and drops the removed member's key. Returns the new
// CryptoKey so the caller can update its local cache.
export async function rotateGroupKey(
  conversationId: string,
  removedUserId: string
): Promise<CryptoKey> {
  const me = await supabase.auth.getUser();
  if (!me.data.user) throw new Error('Not authenticated');
  const myPrivate = getPrivateKey();
  if (!myPrivate) throw new Error('Encryption keys are not ready');

  const mine = await fetchMyGroupKey(conversationId);
  if (!mine) throw new Error('No group key available');
  const oldRaw = await decryptMessage(mine.encryptedKey, myPrivate, decodeKey(mine.encryptorPublic));
  const oldKey = await importSymmetricKey(oldRaw);

  const newSym = await generateSymmetricKey();
  const newRaw = await exportSymmetricKey(newSym);
  const myPublicB64 = encodeKey(publicFromPrivate(myPrivate));

  // 1) Re-encrypt all existing encrypted messages with the new key.
  const PAGE = 200;
  for (let from = 0; ; from += PAGE) {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, content')
      .eq('conversation_id', conversationId)
      .eq('encrypted', true)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (messages as { id: string; content: string }[]) ?? [];
    for (const m of batch) {
      try {
        const plain = await aesDecrypt(m.content, oldKey);
        const newCipher = await aesEncrypt(plain, newSym);
        await supabase.from('messages').update({ content: newCipher }).eq('id', m.id);
      } catch {
        /* skip any message we cannot decrypt */
      }
    }
    if (batch.length < PAGE) break;
  }

  // 2) Re-seal the new key to every remaining member (including the admin).
  const { data: participants, error: pErr } = await supabase
    .from('conversation_participants')
    .select('user_id, profiles(id, public_key)')
    .eq('conversation_id', conversationId)
    .neq('user_id', removedUserId);
  if (pErr) throw new Error(pErr.message);

  const remaining = (participants as Array<{ user_id: string; profiles: { public_key: string | null } | null }>).filter(
    (p) => p.profiles?.public_key
  );
  const rows = await Promise.all(
    remaining.map(async (p) => ({
      conversation_id: conversationId,
      user_id: p.user_id,
      encrypted_key: await encryptMessage(newRaw, myPrivate, decodeKey(p.profiles!.public_key!)),
      encryptor_public: myPublicB64
    }))
  );
  if (rows.length) {
    const { error: upsertErr } = await supabase
      .from('conversation_keys')
      .upsert(rows, { onConflict: 'conversation_id,user_id' });
    if (upsertErr) throw new Error(upsertErr.message);
  }

  // 3) Drop the removed member's sealed key so they can no longer decrypt.
  const { error: delErr } = await supabase
    .from('conversation_keys')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', removedUserId);
  if (delErr) throw new Error(delErr.message);

  return newSym;
}
