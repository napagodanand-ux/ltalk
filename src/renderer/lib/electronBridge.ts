import { supabase } from './supabase';

type Api = ElectronApi;

function createFallback(): Api {
  const localGet = (key: string): unknown => {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  const localSet = (key: string, value: unknown): void => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const localDelete = (key: string): void => {
    localStorage.removeItem(key);
  };

  return {
    auth: {
      signUp: async (payload) => {
        const { data, error } = await supabase.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: { data: { username: payload.username, display_name: payload.displayName } }
        });
        if (error) throw new Error(error.message);
        return { user: data.user as never, session: data.session as never };
      },
      signIn: async (payload) => {
        let email = payload.identifier;
        if (!payload.identifier.includes('@')) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', payload.identifier)
            .single();
          if (error || !profile?.email) throw new Error('No account found with that username');
          email = profile.email;
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: payload.password });
        if (error) throw new Error(error.message);
        return { user: data.user as never, session: data.session as never };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      getSession: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session
          ? ({ user: data.session.user as never, session: data.session as never } as never)
          : null;
      },
      getUser: async () => {
        const { data } = await supabase.auth.getUser();
        return (data.user ?? null) as never;
      }
    },
    storage: {
      set: async (key, value) => localSet(key, value),
      get: async (key) => localGet(key),
      delete: async (key) => localDelete(key)
    },
    secure: {
      storeKey: async (key, value) => localSet(`secure.${key}`, value),
      getKey: async (key) => {
        const value = localGet(`secure.${key}`);
        return value == null ? null : String(value);
      }
    },
    updates: {
      check: async () => false,
      install: async () => {}
    },
    window: {
      minimize: () => {},
      maximize: () => {},
      restore: () => {},
      close: () => {},
      isMaximized: async () => false
    },
    notifications: {
      send: async (title, body) => {
        if (typeof Notification === 'undefined') return false;
        if (Notification.permission !== 'granted') return false;
        try {
          new Notification(title, { body });
          return true;
        } catch {
          return false;
        }
      },
      permission: async () =>
        typeof Notification !== 'undefined' && Notification.permission !== 'denied'
    },
    tray: {
      setBadge: () => {}
    },
    messages: {
      deleteForEveryone: async (conversationId, messageId) => {
        await supabase
          .from('messages')
          .update({ content: null, type: 'text' })
          .eq('id', messageId)
          .eq('conversation_id', conversationId);
        return true;
      },
      markRead: async (_conversationId) => {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', _conversationId);
        return true;
      }
    },
    friendships: {
      canMessage: async () => true,
      block: async () => true
    },
    on: () => () => {}
  };
}

export function installElectronBridge(): void {
  if (typeof window !== 'undefined' && !window.electron) {
    (window as unknown as { electron: Api }).electron = createFallback();
  }
}
