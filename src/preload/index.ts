import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import { IPC } from '../shared/constants';

export interface ElectronApi {
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
    download: () => Promise<boolean>;
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
  app: {
    version: () => Promise<string>;
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
  isElectron: boolean;
}

const api: ElectronApi = {
  isElectron: true,
  auth: {
    signUp: (payload) => ipcRenderer.invoke(IPC.auth.signUp, payload),
    signIn: (payload) => ipcRenderer.invoke(IPC.auth.signIn, payload),
    signOut: () => ipcRenderer.invoke(IPC.auth.signOut),
    getSession: () => ipcRenderer.invoke(IPC.auth.getSession),
    getUser: () => ipcRenderer.invoke(IPC.auth.getUser)
  },
  storage: {
    set: (key, value) => ipcRenderer.invoke(IPC.storage.set, key, value),
    get: (key) => ipcRenderer.invoke(IPC.storage.get, key),
    delete: (key) => ipcRenderer.invoke(IPC.storage.delete, key)
  },
  secure: {
    storeKey: (key, value) => ipcRenderer.invoke(IPC.secure.storeKey, key, value),
    getKey: (key) => ipcRenderer.invoke(IPC.secure.getKey, key)
  },
  updates: {
    check: () => ipcRenderer.invoke(IPC.updates.check),
    download: () => ipcRenderer.invoke(IPC.updates.download),
    install: () => ipcRenderer.invoke(IPC.updates.install)
  },
  window: {
    minimize: () => ipcRenderer.send(IPC.window.minimize),
    maximize: () => ipcRenderer.send(IPC.window.maximize),
    restore: () => ipcRenderer.send(IPC.window.restore),
    close: () => ipcRenderer.send(IPC.window.close),
    isMaximized: () => ipcRenderer.invoke(IPC.window.isMaximized)
  },
  notifications: {
    send: (title, body) => ipcRenderer.invoke(IPC.notifications.send, title, body),
    permission: () => ipcRenderer.invoke(IPC.notifications.permission)
  },
  app: {
    version: () => ipcRenderer.invoke(IPC.app.version)
  },
  tray: {
    setBadge: (count) => ipcRenderer.send(IPC.tray.setBadge, count)
  },
  messages: {
    deleteForEveryone: (conversationId, messageId) =>
      ipcRenderer.invoke('messages:deleteForEveryone', conversationId, messageId),
    markRead: (conversationId, upToMessageId) =>
      ipcRenderer.invoke('messages:markRead', conversationId, upToMessageId)
  },
  friendships: {
    canMessage: (targetUserId) => ipcRenderer.invoke('friendships:canMessage', targetUserId),
    block: (targetUserId) => ipcRenderer.invoke('friendships:block', targetUserId)
  },
  on: (channel, callback) => {
    const listener = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
};

contextBridge.exposeInMainWorld('electron', api);

declare global {
  interface Window {
    electron: ElectronApi;
  }
}
