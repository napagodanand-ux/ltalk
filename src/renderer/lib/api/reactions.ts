import { supabase } from '../supabase';
import type { Reaction } from '../../../../src/shared/types';

export async function fetchReactions(conversationId: string): Promise<Reaction[]> {
  const { data: messages } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId);
  const ids = (messages ?? []).map((m) => (m as { id: string }).id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('reactions').select('*').in('message_id', ids);
  if (error || !data) return [];
  return data as Reaction[];
}

// Toggles the current user's reaction on a message. A second tap on the same
// emoji removes it; tapping a different emoji swaps it. The realtime
// subscription reconciles the local optimistic update.
export async function setReaction(messageId: string, emoji: string): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from('reactions')
    .select('*')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing && (existing as Reaction).emoji === emoji) {
    await supabase.from('reactions').delete().eq('message_id', messageId).eq('user_id', user.id);
  } else if (existing) {
    await supabase
      .from('reactions')
      .update({ emoji })
      .eq('message_id', messageId)
      .eq('user_id', user.id);
  } else {
    await supabase.from('reactions').insert({ message_id: messageId, user_id: user.id, emoji });
  }
}
