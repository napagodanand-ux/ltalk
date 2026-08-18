import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../../../src/shared/types';

import * as authApi from '../lib/api/auth';
import { updateProfile } from '../lib/api/profiles';
import { generateKeyPair, encodeKey, decodeKey, publicFromPrivate, encryptKeyBackup, decryptKeyBackup } from '../lib/encryption';
import { setPrivateKey, clearPrivateKey } from '../lib/keys';
import { useUiStore } from './uiStore';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  initialized: boolean;
  loading: boolean;
  pendingRestore: boolean;
  restoreError: string | null;
  initialize: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  setPendingRestore: (value: boolean) => void;
  restoreWithPassword: (password: string) => Promise<boolean>;
}

function publicMatches(privateJwk: JsonWebKey, publicB64: string | null): boolean {
  if (!publicB64) return false;
  try {
    return encodeKey(publicFromPrivate(privateJwk)) === publicB64;
  } catch {
    return false;
  }
}

// Resolves this device's E2EE private key:
//   1. reuse the locally stored key when it matches the canonical public key;
//   2. otherwise recover it from the password-encrypted backup (when we have
//      the password, e.g. at login/register);
//   3. otherwise generate a fresh pair and, when possible, back it up.
// Returns `needsRestore: true` when a backup exists but no password is
// available yet (session restore on a new device) so the UI can prompt.
async function bootstrapKeys(profile: Profile, password?: string): Promise<{ needsRestore: boolean }> {
  const cipher = profile.key_backup_cipher;
  const salt = profile.key_backup_salt;
  const hasBackup = Boolean(cipher && salt);

  // 1) Reuse the locally stored key when it matches the canonical public key.
  const stored = await window.electron.secure.getKey('privateKey');
  if (stored) {
    try {
      const priv = decodeKey(stored);
      if (publicMatches(priv, profile.public_key)) {
        setPrivateKey(priv);
        return { needsRestore: false };
      }
    } catch {
      /* fall through to recovery */
    }
  }

  // 2) Recover from the password-encrypted backup. Critically: if a backup
  //    exists but it fails to restore (wrong password, corrupt, or no longer
  //    matches the registered public key) we must NEVER regenerate and
  //    overwrite the canonical public key — that would orphan every existing
  //    conversation and make them all unreadable ("🔒 Encrypted message").
  if (hasBackup && password) {
    try {
      const priv = await decryptKeyBackup(cipher, salt, password);
      if (publicMatches(priv, profile.public_key)) {
        setPrivateKey(priv);
        await window.electron.secure.storeKey('privateKey', encodeKey(priv));
        return { needsRestore: false };
      }
    } catch {
      /* fall through */
    }
    return { needsRestore: true };
  }

  // 3) No backup yet: brand-new or legacy account. Generate a fresh key and
  //    publish its public key (original single-device behaviour). We only ever
  //    overwrite the public key here, where no prior key/backup exists.
  if (!hasBackup) {
    const pair = await generateKeyPair();
    setPrivateKey(pair.privateKeyJwk);
    await window.electron.secure.storeKey('privateKey', encodeKey(pair.privateKeyJwk));
    const updates: Partial<Profile> = { public_key: encodeKey(pair.publicKeyJwk) };
    if (password) {
      const backup = await encryptKeyBackup(pair.privateKeyJwk, password);
      updates.key_backup_cipher = backup.cipher;
      updates.key_backup_salt = backup.salt;
    }
    await updateProfile(profile.id, updates);
    return { needsRestore: false };
  }

  // 4) Backup present but no password supplied yet (session restore on a new
  //    device) — ask the UI to prompt for the password.
  return { needsRestore: true };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  initialized: false,
  loading: false,
  pendingRestore: false,
  restoreError: null,

  initialize: async () => {
    const result = await authApi.restoreSession();
    if (result?.user && result.session) {
      const profile = await authApi.getProfile();
      let needsRestore = false;
      if (profile) {
        const r = await bootstrapKeys(profile);
        needsRestore = r.needsRestore;
      }
      set({ user: result.user, session: result.session, profile, pendingRestore: needsRestore, initialized: true });
    } else {
      set({ initialized: true });
    }
  },

  login: async (identifier, password) => {
    set({ loading: true });
    try {
      const result = await authApi.signIn({ identifier, password });
      if (!result.user) throw new Error('Sign in failed');
      const profile = await authApi.getProfile();
      let needsRestore = false;
      if (profile) {
        const r = await bootstrapKeys(profile, password);
        needsRestore = r.needsRestore;
      }
      set({ user: result.user, session: result.session, profile, pendingRestore: needsRestore });
    } finally {
      set({ loading: false });
    }
  },

  register: async (input) => {
    set({ loading: true });
    try {
      const result = await authApi.signUp(input);
      if (!result.user) throw new Error('Sign up failed');
      const profile = await authApi.getProfile();
      let needsRestore = false;
      if (profile) {
        const r = await bootstrapKeys(profile, input.password);
        needsRestore = r.needsRestore;
      }
      set({ user: result.user, session: result.session, profile, pendingRestore: needsRestore });

      // Offer to enable notifications once, on first sign-up, unless the user
      // has already gone through the onboarding flow before.
      try {
        const onboarded = await window.electron.storage.get('app.notifOnboarded');
        if (!onboarded) useUiStore.getState().setNotifOnboarding(true);
      } catch {
        useUiStore.getState().setNotifOnboarding(true);
      }
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    await authApi.signOut();
    clearPrivateKey();
    set({ user: null, session: null, profile: null, pendingRestore: false, restoreError: null });
  },

  refreshProfile: async () => {
    const profile = await authApi.getProfile();
    if (profile) set({ profile });
  },

  setProfile: (profile) => set({ profile }),

  setPendingRestore: (value) => set({ pendingRestore: value }),

  restoreWithPassword: async (password) => {
    const profile = get().profile;
    if (!profile?.key_backup_cipher || !profile?.key_backup_salt) {
      set({ restoreError: 'No recovery key is available for this account.' });
      return false;
    }
    try {
      const priv = await decryptKeyBackup(profile.key_backup_cipher, profile.key_backup_salt, password);
      if (!publicMatches(priv, profile.public_key)) {
        set({ restoreError: 'This password does not match your encryption key.' });
        return false;
      }
      setPrivateKey(priv);
      await window.electron.secure.storeKey('privateKey', encodeKey(priv));
      set({ pendingRestore: false, restoreError: null });
      return true;
    } catch {
      set({ restoreError: 'Incorrect password. Please try again.' });
      return false;
    }
  }
}));
