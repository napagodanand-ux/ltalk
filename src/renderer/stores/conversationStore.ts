import { create } from 'zustand';
import type { Conversation, Message, Profile } from '../../../src/shared/types';

import * as conversationApi from '../lib/api/conversations';
import { useUiStore } from './uiStore';

export interface ConversationView extends Conversation {
  participants: Profile[];
  lastMessage: import('../../../src/shared/types').Message | null;
  unreadCount: number;
}

interface ConversationState {
  conversations: ConversationView[];
  activeId: string | null;
  loading: boolean;
  load: () => Promise<void>;
  select: (id: string | null) => void;
  upsert: (conversation: ConversationView) => void;
  setUnread: (id: string, count: number) => void;
  remove: (id: string) => void;
  getById: (id: string) => ConversationView | undefined;
  applyIncoming: (conversationId: string, message: Message) => void;
  updateLastMessage: (conversationId: string, message: Message | null) => void;
  clearLastMessageIfMatch: (conversationId: string, messageId: string) => void;
  updateParticipantProfile: (profile: Profile) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeId: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const conversations = (await conversationApi.listConversations()) as ConversationView[];
      set({ conversations });
    } finally {
      set({ loading: false });
    }
  },

  select: (id) => set({ activeId: id }),

  remove: (id) => {
    set({
      conversations: get().conversations.filter((c) => c.id !== id),
      activeId: get().activeId === id ? null : get().activeId
    });
  },

  upsert: (conversation) => {
    const existing = get().conversations.find((c) => c.id === conversation.id);
    if (existing) {
      set({
        conversations: get().conversations.map((c) =>
          c.id === conversation.id ? conversation : c
        )
      });
    } else {
      set({ conversations: [conversation, ...get().conversations] });
    }
  },

  setUnread: (id, count) => {
    set({
      conversations: get().conversations.map((c) =>
        c.id === id ? { ...c, unreadCount: count } : c
      )
    });
  },

  getById: (id) => get().conversations.find((c) => c.id === id),

  // Live update of the sidebar preview + unread badge when a message arrives in
  // any conversation. Bumps the conversation to the top and increments the
  // unread count unless it's the one being viewed or it's muted.
  applyIncoming: (conversationId, message) => {
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conversationId);
      if (idx === -1) return state;
      const conv = state.conversations[idx];
      const isActive = state.activeId === conversationId;
      const muted = useUiStore.getState().isMuted(conversationId);
      const unreadCount = conv.unreadCount + (isActive || muted ? 0 : 1);
      const updated = { ...conv, lastMessage: message, unreadCount };
      const rest = state.conversations.filter((c) => c.id !== conversationId);
      return { conversations: [updated, ...rest] };
    });
  },

  updateLastMessage: (conversationId, message) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, lastMessage: message } : c
      )
    }));
  },

  clearLastMessageIfMatch: (conversationId, messageId) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId && c.lastMessage?.id === messageId
          ? { ...c, lastMessage: null }
          : c
      )
    }));
  },

  // Propagate a profile change (avatar, display name, status, ...) everywhere
  // it appears — sidebar items, group headers, friends list via friendStore.
  updateParticipantProfile: (profile) => {
    set((state) => ({
      conversations: state.conversations.map((c) => ({
        ...c,
        participants: c.participants.map((p) => (p.id === profile.id ? { ...p, ...profile } : p))
      }))
    }));
  }
}));
