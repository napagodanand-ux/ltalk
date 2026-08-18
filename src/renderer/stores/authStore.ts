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
  resetEncryption: (password: string) => Promise<boolean>;
}

// Compare by the actual public key point, not the JSON-string encoding. The
// registered public key (full JWK) and the derived one (compact) serialize
// differently, so a naive string compare is always false and would make the
// local key look untrusted. Comparing the raw x/y is encoding-agnostic.
function publicMatches(privateJwk: JsonWebKey, publicB64: string | null): boolean {
  if (!publicB64) return false;
  try {
    const derived = publicFromPrivate(privateJwk);
    const stored = JSON.parse(atob(publicB64)) as JsonWebKey;
    return (
      derived.kty === stored.kty &&
      derived.crv === stored.crv &&
      derived.x === stored.x &&
      derived.y === stored.y
    );
  } catch {
    return false;
  }
}

// The web "secure" store is shared localStorage keyed by a fixed name, so two
// accounts in one browser would overwrite each other's private key on
// session-restore and decrypt every conversation as "🔒 Encrypted message".
// Namespace the stored key per user id. The unscoped name is kept as a
// one-time fallback so existing web clients migrate automatically.
async function readStoredKey(userId: string, publicKey: string | null): Promise<string | null> {
  const scoped = await window.electron.secure.getKey('privateKey_' + userId);
  if (scoped) return scoped;
  // One-time migration from the old unscoped name. Only adopt it if it actually
  // belongs to this account — otherwise it's a leftover from another account in
  // this shared browser and must be ignored (the caller will restore instead).
  const legacy = await window.electron.secure.getKey('privateKey');
  if (legacy) {
    try {
      const priv = decodeKey(legacy);
      if (publicMatches(priv, publicKey)) {
        await window.electron.secure.storeKey('privateKey_' + userId, legacy);
        return legacy;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function writeStoredKey(userId: string, value: string): Promise<void> {
  await window.electron.secure.storeKey('privateKey_' + userId, value);
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

  // 1) Reuse the locally stored key. The namespaced store key is scoped to this
  //    account, so it is the authoritative device key. Keep the server's
  //    registered public key in sync with it: if they diverge (registered key
  //    drifted, or the other device rotated/resetted the key), republish the
  //    matching public key so counterparties can derive the shared secret.
  const stored = await readStoredKey(profile.id, profile.public_key);
  if (stored) {
    try {
      const priv = decodeKey(stored);
      setPrivateKey(priv);
      if (!publicMatches(priv, profile.public_key)) {
        await updateProfile(profile.id, { public_key: encodeKey(publicFromPrivate(priv)) });
      }
      return { needsRestore: false };
    } catch {
      /* fall through to recovery */
    }
  }

  // 2) Recover from the password-encrypted backup. The backup is encrypted with
  //    the account password, so a successful decrypt is authoritative proof of
  //    the user's real key. We adopt it and (self-heal) re-publish its public
  //    key, repairing any drift in the registered `public_key` (e.g. left
  //    behind by an earlier bug) that would otherwise make every conversation
  //    unreadable ("🔒 Encrypted message"). We must NEVER regenerate/overwrite
  //    the key when the backup cannot be restored.
  if (hasBackup && password) {
    try {
      const priv = await decryptKeyBackup(cipher, salt, password);
      setPrivateKey(priv);
      await writeStoredKey(profile.id, encodeKey(priv));
      const pub = encodeKey(publicFromPrivate(priv));
      if (pub !== profile.public_key) {
        await updateProfile(profile.id, { public_key: pub });
      }
      return { needsRestore: false };
    } catch {
      /* wrong password or corrupt backup — do NOT overwrite the public key */
    }
    return { needsRestore: true };
  }

  // 3) No backup yet: brand-new or legacy account. Generate a fresh key and
  //    publish its public key (original single-device behaviour). We only ever
  //    overwrite the public key here, where no prior key/backup exists.
  if (!hasBackup) {
    const pair = await generateKeyPair();
    setPrivateKey(pair.privateKeyJwk);
    await writeStoredKey(profile.id, encodeKey(pair.privateKeyJwk));
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

export const useAuthStore = create<AuthState>((set, get) => ({
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
    const id = get().user?.id ?? get().profile?.id;
    await authApi.signOut();
    clearPrivateKey();
    if (id) {
      try {
        await window.electron.storage.delete('secure.privateKey_' + id);
      } catch {
        /* ignore */
      }
    }
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
      setPrivateKey(priv);
      await writeStoredKey(profile.id, encodeKey(priv));
      // The backup is authoritative: re-publish its public key so a drifted
      // registered key is repaired and conversations become readable again.
      const pub = encodeKey(publicFromPrivate(priv));
      if (pub !== profile.public_key) {
        await updateProfile(profile.id, { public_key: pub });
      }
      set({ pendingRestore: false, restoreError: null });
      return true;
    } catch {
      set({ restoreError: 'Incorrect password. Please try again.' });
      return false;
    }
  },

  resetEncryption: async (password) => {
    const profile = get().profile;
    if (!profile) return false;
    try {
      // Break-glass recovery: the password-backed backup cannot be restored
      // (e.g. the account password was changed after sign-up), so the
      // registered public key is permanently mismatched with the device key.
      // Generate a fresh pair, publish its public key, and re-backup it with
      // the *current* password so future restores work. Old messages are
      // unrecoverable, but new ones become readable again.
      const pair = await generateKeyPair();
      setPrivateKey(pair.privateKeyJwk);
      await writeStoredKey(profile.id, encodeKey(pair.privateKeyJwk));
      const backup = await encryptKeyBackup(pair.privateKeyJwk, password);
      await updateProfile(profile.id, {
        public_key: encodeKey(pair.publicKeyJwk),
        key_backup_cipher: backup.cipher,
        key_backup_salt: backup.salt
      });
      set({ pendingRestore: false, restoreError: null });
      return true;
    } catch {
      set({ restoreError: 'Could not reset encryption keys.' });
      return false;
    }
  }
}));
