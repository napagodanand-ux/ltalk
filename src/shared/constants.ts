export const APP_NAME = 'LTalk';

export const STORE_KEYS = {
  theme: 'app.theme',
  privateKey: 'crypto.privateKey',
  publicKey: 'crypto.publicKey',
  windowBounds: 'window.bounds'
} as const;

export const IPC = {
  auth: {
    signUp: 'auth:signUp',
    signIn: 'auth:signIn',
    signOut: 'auth:signOut',
    getSession: 'auth:getSession',
    getUser: 'auth:getUser'
  },
  storage: {
    set: 'storage:set',
    get: 'storage:get',
    delete: 'storage:delete'
  },
  updates: {
    check: 'updates:check',
    install: 'updates:install',
    status: 'updates:status'
  },
  window: {
    minimize: 'window:minimize',
    maximize: 'window:maximize',
    close: 'window:close',
    isMaximized: 'window:isMaximized',
    restore: 'window:restore'
  },
  notifications: {
    send: 'notifications:send',
    permission: 'notifications:permission'
  },
  tray: {
    setBadge: 'tray:setBadge'
  },
  secure: {
    storeKey: 'secure:storeKey',
    getKey: 'secure:getKey'
  },
  app: {
    version: 'app:version'
  }
} as const;

export const MESSAGES_PER_PAGE = 50;

export const E2EE = {
  curve: 'P-256',
  hash: 'SHA-256',
  aesAlg: 'AES-GCM',
  keyLength: 256
} as const;

export const FRIEND_ONLY_CONVERSATIONS = true;
