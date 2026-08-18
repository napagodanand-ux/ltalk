import { supabase } from '../supabase';
import type { Profile } from '../../../../src/shared/types';

// Columns safe to return to other users (never the encrypted key backup).
const PROFILE_PUBLIC_SELECT =
  'id, username, display_name, avatar_url, bio, public_key, status, last_seen';

export async function fetchProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_PUBLIC_SELECT)
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function searchUsers(query: string, limit = 20): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_PUBLIC_SELECT)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(limit);
  if (error) return [];
  return data as Profile[];
}

export async function updateProfile(
  userId: string,
  updates: Partial<
    Pick<
      Profile,
      'display_name' | 'bio' | 'avatar_url' | 'public_key' | 'key_backup_cipher' | 'key_backup_salt'
    >
  >
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const path = `avatars/${userId}`;
  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}
