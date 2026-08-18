import { ipcMain, IpcMainInvokeEvent, app } from 'electron';
import { safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

import { IPC } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { log } from '../logger';
import type { Session } from '@supabase/supabase-js';

function getAt(obj: Record<string, unknown>, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function setAt(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const keys = keyPath.split('.');
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

function deleteAt(obj: Record<string, unknown>, keyPath: string): void {
  const keys = keyPath.split('.');
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof cursor[key] !== 'object' || cursor[key] === null) return;
    cursor = cursor[key] as Record<string, unknown>;
  }
  delete cursor[keys[keys.length - 1]];
}

let storePath: string | null = null;
function getStorePath(): string {
  if (!storePath) {
    storePath = path.join(app.getPath('userData'), 'store.json');
  }
  return storePath;
}

let data: Record<string, unknown> = {};
function loadData(): void {
  try {
    data = JSON.parse(fs.readFileSync(getStorePath(), 'utf-8')) as Record<string, unknown>;
  } catch {
    data = {};
  }
}

function saveData(): void {
  fs.mkdirSync(path.dirname(getStorePath()), { recursive: true });
  fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2));
}

loadData();

function storeGet(key: string): unknown {
  return getAt(data, key);
}

function storeSet(key: string, value: unknown): void {
  setAt(data, key, value);
  saveData();
}

function storeDelete(key: string): void {
  deleteAt(data, key);
  saveData();
}

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }
  return safeStorage.encryptString(value).toString('base64');
}

function decrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return value;
  }
  return safeStorage.decryptString(Buffer.from(value, 'base64'));
}

function sessionToRecord(session: Session): Record<string, unknown> {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user
  };
}

function persistSession(session: Session | null): void {
  if (!session) {
    storeDelete('app.session');
    return;
  }
  storeSet('app.session', encrypt(JSON.stringify(sessionToRecord(session))));
}

function loadSession(): Session | null {
  const raw = storeGet('app.session') as string | undefined;
  if (!raw) return null;
  try {
    return JSON.parse(decrypt(raw)) as Session;
  } catch (error) {
    log.error('Failed to load persisted session', error);
    return null;
  }
}

export function registerStorageHandlers(): void {
  ipcMain.handle(IPC.storage.set, (_event: IpcMainInvokeEvent, key: string, value: unknown) => {
    storeSet(key, value);
  });

  ipcMain.handle(IPC.storage.get, (_event: IpcMainInvokeEvent, key: string) => {
    return storeGet(key);
  });

  ipcMain.handle(IPC.storage.delete, (_event: IpcMainInvokeEvent, key: string) => {
    storeDelete(key);
  });

  ipcMain.handle(IPC.secure.storeKey, (_event: IpcMainInvokeEvent, key: string, value: string) => {
    storeSet(`secure.${key}`, encrypt(value));
  });

  ipcMain.handle(IPC.secure.getKey, (_event: IpcMainInvokeEvent, key: string): string | null => {
    const raw = storeGet(`secure.${key}`) as string | undefined;
    if (!raw) return null;
    try {
      return decrypt(raw);
    } catch (error) {
      log.error('Failed to decrypt secure key', error);
      return null;
    }
  });
}

export { persistSession, loadSession, supabase as authSupabase };
