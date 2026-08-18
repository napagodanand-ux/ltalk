import { supabase } from '../supabase';
import type { Conversation, ConversationParticipant, Message, Profile } from '../../../../src/shared/types';
import { decryptMessage } from '../encryption';
import { getPrivateKey } from '../keys';

export interface ConversationWithParticipants extends Conversation {
  participants: Profile[];
  lastMessage: Message | null;
  unreadCount: number;
}

// Decrypts a conversation preview message (the sidebar's last-message text).
// Mirrors the chat-view decryption: for a 1:1 conversation the counterparty is
// the other participant, so we derive the key from their public key.
async function decryptPreview(
  message: Message | null,
  participants: Profile[],
  meId: string
): Promise<Message | null> {
  if (!message || !message.encrypted || !message.content) return message;
  const privateKey = getPrivateKey();
  if (!privateKey) return message;

  const other = participants.find((p) => p.id !== meId);
  let publicKey: JsonWebKey | null = null;
  if (other?.public_key) {
    try {
      publicKey = JSON.parse(atob(other.public_key)) as JsonWebKey;
    } catch {
      publicKey = null;
    }
  }
  if (!publicKey) return message;

  try {
    const plain = await decryptMessage(message.content, privateKey, publicKey);
    return { ...message, content: plain };
  } catch {
    return { ...message, content: '🔒 Encrypted message' };
  }
}

export async function listConversations(): Promise<ConversationWithParticipants[]> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Messages this user has hidden with "Delete for me" — excluded from the
  // conversation preview and unread counts so the sidebar reflects the hide.
  let deletedIds: string[] = [];
  try {
    const { data: delRows } = await supabase
      .from('message_deletions')
      .select('message_id')
      .eq('user_id', user.id);
    deletedIds = (delRows ?? []).map((r) => (r as { message_id: string }).message_id);
  } catch {
    deletedIds = [];
  }

  const { data: participants, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id);

  if (error || !participants.length) return [];

  const conversationIds = participants.map((p) => p.conversation_id);

  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .in('id', conversationIds)
    .order('updated_at', { ascending: false });

  if (convError) return [];

  const results = await Promise.all(
    (conversations as Conversation[]).map(async (conversation) => {
      const participantsData = await fetchParticipants(conversation.id);
      const rawLastMessage = await fetchLastMessage(conversation.id, deletedIds);
      const lastMessage = await decryptPreview(rawLastMessage, participantsData, user.id);
      const unreadCount = await countUnread(conversation.id, user.id, deletedIds);
      return { ...conversation, participants: participantsData, lastMessage, unreadCount };
    })
  );

  return results;
}

async function fetchParticipants(conversationId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId);
  if (!data?.length) return [];
  const ids = data.map((p) => p.user_id);
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
  return (profiles as Profile[]) ?? [];
}

async function fetchLastMessage(conversationId: string, deletedIds: string[] = []): Promise<Message | null> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId);
  if (deletedIds.length) query = query.not('id', 'in', `(${deletedIds.join(',')})`);
  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Message) ?? null;
}

async function countUnread(conversationId: string, userId: string, deletedIds: string[] = []): Promise<number> {
  let query = supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .eq('is_read', false);
  if (deletedIds.length) query = query.not('id', 'in', `(${deletedIds.join(',')})`);
  const { count } = await query;
  return count ?? 0;
}

export async function createConversation(
  participantIds: string[],
  options?: { isGroup?: boolean; name?: string; groupAvatarUrl?: string }
): Promise<Conversation> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      is_group: options?.isGroup ?? false,
      name: options?.name ?? null,
      group_avatar_url: options?.groupAvatarUrl ?? null,
      created_by: user.id
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const rows: ConversationParticipant[] = [user.id, ...participantIds].map((userId) => ({
    conversation_id: conversation.id,
    user_id: userId,
    joined_at: new Date().toISOString(),
    last_read_message_id: null
  }));

  const { error: partError } = await supabase
    .from('conversation_participants')
    .insert(rows);
  if (partError) throw new Error(partError.message);

  return conversation as Conversation;
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Conversation;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
  if (error) throw new Error(error.message);
}

export async function addParticipants(
  conversationId: string,
  userIds: string[]
): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const rows: ConversationParticipant[] = [user.id, ...userIds].map((userId) => ({
    conversation_id: conversationId,
    user_id: userId,
    joined_at: new Date().toISOString(),
    last_read_message_id: null
  }));

  const { error } = await supabase.from('conversation_participants').insert(rows);
  if (error) throw new Error(error.message);
}

export async function clearMessages(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId);
  if (error) throw new Error(error.message);
}
