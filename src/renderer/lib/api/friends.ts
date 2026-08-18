import { supabase } from '../supabase';
import type { Friendship, FriendshipStatus, Profile } from '../../../../src/shared/types';

export async function listFriends(): Promise<Profile[]> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select('friend_id, user_id, status')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq('status', 'accepted');
  if (error) return [];

  const ids = (data as Array<{ user_id: string; friend_id: string }>).map((row) =>
    row.user_id === user.id ? row.friend_id : row.user_id
  );

  if (!ids.length) return [];
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
  return (profiles as Profile[]) ?? [];
}

export async function listPendingRequests(): Promise<
  Array<Friendship & { profile: Profile }>
> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('friend_id', user.id)
    .eq('status', 'pending');
  if (error) return [];

  const result = await Promise.all(
    (data as Friendship[]).map(async (friendship) => {
      const profile = await fetchProfileById(friendship.user_id);
      return { ...friendship, profile: profile as Profile };
    })
  );
  return result;
}

export async function sendFriendRequest(friendId: string): Promise<void> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: user.id, friend_id: friendId, status: 'pending' });
  if (error) throw new Error(error.message);
}

export async function respondToRequest(
  friendshipId: string,
  accept: boolean
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('id', friendshipId);
  if (error) throw new Error(error.message);
}

export async function blockUser(friendId: string): Promise<void> {
  await window.electron.friendships.block(friendId);
}

async function fetchProfileById(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return (data as Profile) ?? null;
}

export type { FriendshipStatus };
