export {};

declare global {
  interface ElectronApi {
    auth: {
      signUp: (payload: {
        email: string;
        password: string;
        username: string;
        displayName: string;
      }) => Promise<{ user: unknown; session: unknown }>;
      signIn: (payload: { identifier: string; password: string }) => Promise<{
        user: unknown;
        session: unknown;
      }>;
      signOut: () => Promise<void>;
      getSession: () => Promise<{ user: unknown; session: unknown } | null>;
      getUser: () => Promise<unknown>;
    };
    storage: {
      set: (key: string, value: unknown) => Promise<void>;
      get: (key: string) => Promise<unknown>;
      delete: (key: string) => Promise<void>;
    };
    secure: {
      storeKey: (key: string, value: string) => Promise<void>;
      getKey: (key: string) => Promise<string | null>;
    };
    updates: {
      check: () => Promise<boolean>;
      install: () => Promise<void>;
    };
    window: {
      minimize: () => void;
      maximize: () => void;
      restore: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
    };
    notifications: {
      send: (title: string, body: string) => Promise<boolean>;
      permission: () => Promise<boolean>;
    };
    tray: {
      setBadge: (count: number) => void;
    };
    messages: {
      deleteForEveryone: (conversationId: string, messageId: string) => Promise<boolean>;
      markRead: (conversationId: string, upToMessageId: string) => Promise<boolean>;
    };
    friendships: {
      canMessage: (targetUserId: string) => Promise<boolean>;
      block: (targetUserId: string) => Promise<boolean>;
    };
    on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  }

  interface Window {
    electron: ElectronApi;
  }
}
