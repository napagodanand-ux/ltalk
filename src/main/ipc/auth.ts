import { ipcMain, IpcMainInvokeEvent } from 'electron';

import { IPC } from '../lib/constants';
import { authSupabase, persistSession, loadSession } from './storage';
import { log } from '../logger';

interface SignUpPayload {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

interface SignInPayload {
  identifier: string;
  password: string;
}

export function registerAuthHandlers(): void {
  ipcMain.handle(
    IPC.auth.signUp,
    async (_event: IpcMainInvokeEvent, payload: SignUpPayload) => {
      const { email, password, username, displayName } = payload;
      const { data, error } = await authSupabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, display_name: displayName }
        }
      });
      if (error) {
        log.error('Sign up failed', error.message);
        throw new Error(error.message);
      }
      if (data.session) {
        persistSession(data.session);
        await authSupabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token ?? ''
        });
      }
      return { user: data.user, session: data.session };
    }
  );

  ipcMain.handle(
    IPC.auth.signIn,
    async (_event: IpcMainInvokeEvent, payload: SignInPayload) => {
      const { identifier, password } = payload;
      let email = identifier;

      if (!identifier.includes('@')) {
        const { data: profile, error: lookupError } = await authSupabase
          .from('profiles')
          .select('email')
          .eq('username', identifier)
          .single();
        if (lookupError || !profile?.email) {
          throw new Error('No account found with that username');
        }
        email = profile.email;
      }

      const { data, error } = await authSupabase.auth.signInWithPassword({ email, password });
      if (error) {
        log.warn('Password sign-in failed', error.message);
        throw new Error(error.message);
      }
      if (data.session) {
        persistSession(data.session);
        await authSupabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token ?? ''
        });
      }
      return { user: data.user, session: data.session };
    }
  );

  ipcMain.handle(IPC.auth.signOut, async () => {
    await authSupabase.auth.signOut();
    persistSession(null);
  });

  ipcMain.handle(IPC.auth.getSession, async () => {
    const persisted = loadSession();
    if (!persisted?.access_token) return null;
    const { data, error } = await authSupabase.auth.setSession({
      access_token: persisted.access_token,
      refresh_token: persisted.refresh_token ?? ''
    });
    if (error || !data.session) {
      persistSession(null);
      return null;
    }
    persistSession(data.session);
    return { user: data.user, session: data.session };
  });

  ipcMain.handle(IPC.auth.getUser, async () => {
    const { data } = await authSupabase.auth.getUser();
    return data.user ?? null;
  });
}
