import { supabase } from '../supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../../../../src/shared/types';

async function applySession(session: Session | null): Promise<void> {
  if (session) {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token ?? ''
    });
    const { data } = await supabase.auth.getSession();
    void data;
  } else {
    await supabase.auth.signOut();
  }
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
}

export async function signUp(input: {
  email: string;
  password: string;
  username: string;
  displayName: string;
}): Promise<AuthResult> {
  const result = await window.electron.auth.signUp(input);
  await applySession(result.session as Session | null);
  return result as AuthResult;
}

export async function signIn(input: {
  identifier: string;
  password: string;
}): Promise<AuthResult> {
  const result = await window.electron.auth.signIn(input);
  await applySession(result.session as Session | null);
  return result as AuthResult;
}

export async function signOut(): Promise<void> {
  await window.electron.auth.signOut();
  await applySession(null);
}

export async function restoreSession(): Promise<AuthResult | null> {
  const result = await window.electron.auth.getSession();
  if (!result?.session) return null;
  await applySession(result.session as Session);
  return result as AuthResult;
}

export async function getProfile(): Promise<Profile | null> {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) return null;
  return data as Profile;
}
