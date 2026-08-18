import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../../../src/shared/types';

import * as authApi from '../lib/api/auth';
import { updateProfile } from '../lib/api/profiles';
import { generateKeyPair, encodeKey, decodeKey } from '../lib/encryption';
import { setPrivateKey, clearPrivateKey } from '../lib/keys';
import { useUiStore } from './uiStore';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  initialized: boolean;
  loading: boolean;
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
}

async function bootstrapKeys(profile: Profile): Promise<void> {
  if (profile.public_key) {
    const stored = await window.electron.secure.getKey('privateKey');
    if (stored) {
      setPrivateKey(decodeKey(stored));
      return;
    }
  }
  const pair = await generateKeyPair();
  setPrivateKey(pair.privateKeyJwk);
  await window.electron.secure.storeKey('privateKey', encodeKey(pair.privateKeyJwk));
  await updateProfile(profile.id, { public_key: encodeKey(pair.publicKeyJwk) });
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  initialized: false,
  loading: false,

  initialize: async () => {
    const result = await authApi.restoreSession();
    if (result?.user && result.session) {
      const profile = await authApi.getProfile();
      if (profile) await bootstrapKeys(profile);
      set({ user: result.user, session: result.session, profile, initialized: true });
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
      if (profile) await bootstrapKeys(profile);
      set({ user: result.user, session: result.session, profile });
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
      if (profile) await bootstrapKeys(profile);
      set({ user: result.user, session: result.session, profile });

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
    set({ user: null, session: null, profile: null });
  },

  refreshProfile: async () => {
    const profile = await authApi.getProfile();
    if (profile) set({ profile });
  },

  setProfile: (profile) => set({ profile })
}));
