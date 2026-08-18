import { supabase } from '../supabase';
import type { Message, MessageType } from '../../../../src/shared/types';
import { MESSAGES_PER_PAGE } from '../../../../src/shared/constants';

export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  encrypted: boolean;
  replyToId?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
}

export async function sendMessage(input: SendMessageInput): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      content: input.content,
      type: input.type,
      encrypted: input.encrypted,
      reply_to_id: input.replyToId ?? null,
      file_url: input.fileUrl ?? null,
      file_name: input.fileName ?? null,
      file_size: input.fileSize ?? null,
      mime_type: input.mimeType ?? null
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Message;
}

export async function editMessage(
  messageId: string,
  content: string,
  encrypted: boolean
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .update({ content, encrypted, edited: true })
    .eq('id', messageId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Message;
}

export async function fetchMessages(
  conversationId: string,
  before?: string
): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MESSAGES_PER_PAGE);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data as Message[]).reverse();
}

// "Delete for me" only records that THIS user has hidden the message; it
// never touches the message row, so the other participant is unaffected.
// Backed by the `message_deletions` table, so the choice is account-wide.
export async function hideMessageForMe(messageId: string): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('message_deletions')
    .upsert({ user_id: user.id, message_id: messageId }, { onConflict: 'user_id,message_id' });
  if (error) throw new Error(error.message);
}

export async function fetchDeletedMessageIds(): Promise<string[]> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('message_deletions')
    .select('message_id')
    .eq('user_id', user.id);
  if (error || !data) return [];
  return data.map((row) => (row as { message_id: string }).message_id);
}

export async function deleteMessageForEveryone(
  conversationId: string,
  messageId: string
): Promise<void> {
  const ok = await window.electron.messages.deleteForEveryone(conversationId, messageId);
  if (!ok) throw new Error('Failed to delete message');
}

export async function markConversationRead(
  conversationId: string,
  upToMessageId: string
): Promise<void> {
  const ok = await window.electron.messages.markRead(conversationId, upToMessageId);
  if (!ok) throw new Error('Failed to mark conversation read');
}

export async function uploadMedia(
  conversationId: string,
  file: File,
  onProgress?: (ratio: number) => void
): Promise<{ url: string; name: string; size: number; mime: string }> {
  const path = `conversations/${conversationId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  if (onProgress) onProgress(1);
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, size: file.size, mime: file.type };
}
