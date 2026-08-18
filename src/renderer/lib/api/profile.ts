import { supabase } from '../supabase';
import type { Profile } from '../../../../src/shared/types';

export type PresenceStatus = Profile['status'];

// Publishes the current user's presence. RLS allows updating only your own
// profile row; the change is delivered to everyone else through the realtime
// `profiles` subscription, so friends see your status live.
export async function updatePresence(status: PresenceStatus): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('profiles')
    .update({ status, last_seen: new Date().toISOString() })
    .eq('id', user.id);
}
