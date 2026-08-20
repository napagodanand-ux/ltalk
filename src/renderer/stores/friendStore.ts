import { create } from 'zustand';
import type { Friendship, Profile } from '../../../src/shared/types';

import * as friendApi from '../lib/api/friends';

interface FriendState {
  friends: Profile[];
  pending: Array<Friendship & { profile: Profile }>;
  loading: boolean;
  load: () => Promise<void>;
  sendRequest: (userId: string) => Promise<void>;
  respond: (friendshipId: string, accept: boolean) => Promise<void>;
  block: (userId: string) => Promise<void>;
  remove: (userId: string) => Promise<void>;
  updateProfile: (profile: Profile) => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  pending: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const [friends, pending] = await Promise.all([
        friendApi.listFriends(),
        friendApi.listPendingRequests()
      ]);
      set({ friends, pending });
    } finally {
      set({ loading: false });
    }
  },

  sendRequest: async (userId) => {
    await friendApi.sendFriendRequest(userId);
    await get().load();
  },

  respond: async (friendshipId, accept) => {
    await friendApi.respondToRequest(friendshipId, accept);
    await get().load();
  },

  block: async (userId) => {
    await friendApi.blockUser(userId);
    await get().load();
  },

  remove: async (userId) => {
    await friendApi.removeFriend(userId);
    await get().load();
  },

  updateProfile: (profile) => {
    set((state) => ({
      friends: state.friends.map((f) => (f.id === profile.id ? { ...f, ...profile } : f)),
      pending: state.pending.map((p) =>
        p.profile.id === profile.id ? { ...p, profile: { ...p.profile, ...profile } } : p
      )
    }));
  }
}));
