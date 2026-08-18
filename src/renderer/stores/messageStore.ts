import { create } from 'zustand';
import type { Message, Reaction } from '../../../src/shared/types';

import * as messageApi from '../lib/api/messages';
import * as reactionApi from '../lib/api/reactions';
import { supabase } from '../lib/supabase';
import { encryptMessage, decryptMessage } from '../lib/encryption';
import { getPrivateKey } from '../lib/keys';
import { useConversationStore } from './conversationStore';
import { useAuthStore } from './authStore';
import { useUiStore } from './uiStore';
import { notify } from '../lib/notifications';
import { useToastStore } from './toastStore';

function safeParseKey(b64: string): JsonWebKey | null {
  try {
    return JSON.parse(atob(b64)) as JsonWebKey;
  } catch {
    return null;
  }
}

async function getPublicKey(userId: string): Promise<JsonWebKey | null> {
  const { data } = await supabase
    .from('profiles')
    .select('public_key')
    .eq('id', userId)
    .single();
  if (!data?.public_key) return null;
  return safeParseKey(data.public_key);
}

// Decrypt a message using the COUNTERPARTY's public key (the other participant
// in the 1:1 conversation). For a sent message the counterparty is the recipient,
// for a received message it is the sender. Using message.sender_id's key directly
// is wrong for our own messages, so we resolve the other participant instead.
async function decryptIfNeeded(message: Message): Promise<Message> {
  if (!message.encrypted || !message.content) return message;
  const privateKey = getPrivateKey();
  if (!privateKey) return message;
  const meId = useAuthStore.getState().user?.id;
  if (!meId) return message;

  const conversation = useConversationStore
    .getState()
    .conversations.find((c) => c.id === message.conversation_id);
  const other = conversation?.participants.find((p) => p.id !== meId);

  let publicKey: JsonWebKey | null = other?.public_key ? safeParseKey(other.public_key) : null;
  if (!publicKey) publicKey = await getPublicKey(message.sender_id);
  if (!publicKey) return message;

  try {
    const plain = await decryptMessage(message.content, privateKey, publicKey);
    return { ...message, content: plain };
  } catch {
    return { ...message, content: '🔒 Encrypted message' };
  }
}

interface MessageState {
  byConversation: Record<string, Message[]>;
  deletedForMe: string[];
  reactionsByMessage: Record<string, Reaction[]>;
  typing: Record<string, boolean>;
  load: (conversationId: string) => Promise<void>;
  send: (conversationId: string, text: string, replyToId?: string | null) => Promise<void>;
  receive: (message: Message, event: 'INSERT' | 'UPDATE') => Promise<void>;
  editMessage: (messageId: string, conversationId: string, newText: string) => Promise<void>;
  sync: (conversationId: string) => Promise<void>;
  markRead: (conversationId: string) => Promise<void>;
  hideForMe: (messageId: string) => Promise<void>;
  hideForMeRemote: (messageId: string) => void;
  loadDeletedForMe: () => Promise<void>;
  loadReactions: (conversationId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  receiveReaction: (reaction: Reaction, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  notifyTyping: (conversationId: string) => void;
  subscribe: () => () => void;
}

// Filters out messages the current user has hidden with "Delete for me".
// This list is persisted locally, so it applies only to this user's device
// and never affects the other participant's copy of the message.
function withoutHidden(list: Message[], hidden: string[]): Message[] {
  if (!hidden.length) return list;
  const set = new Set(hidden);
  return list.filter((m) => !set.has(m.id));
}

// Adds a message to its conversation, skipping it if a message with the same
// id is already present. This prevents duplicates from the realtime INSERT
// echo racing with the optimistic local insert from `send`.
function upsertMessage(
  state: MessageState,
  message: Message
): Pick<MessageState, 'byConversation'> {
  const existing = state.byConversation[message.conversation_id] ?? [];
  if (existing.some((m) => m.id === message.id)) return state;
  return {
    byConversation: {
      ...state.byConversation,
      [message.conversation_id]: [...existing, message]
    }
  };
}

export const useMessageStore = create<MessageState>((set, get) => ({
  byConversation: {},
  deletedForMe: [],
  reactionsByMessage: {},
  typing: {},

  load: async (conversationId) => {
    const messages = await messageApi.fetchMessages(conversationId);
    const decrypted = await Promise.all(messages.map(decryptIfNeeded));
    const hidden = get().deletedForMe;
    set((state) => ({
      byConversation: {
        ...state.byConversation,
        [conversationId]: withoutHidden(decrypted, hidden)
      }
    }));
  },

  send: async (conversationId, text, replyToId) => {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const conversation = useConversationStore
      .getState()
      .conversations.find((c) => c.id === conversationId);

    let content = text;
    let encrypted = false;
    if (conversation && !conversation.is_group) {
      const other = conversation.participants.find((p) => p.id !== user.id);
      if (other?.public_key) {
        const privateKey = getPrivateKey();
        const theirPublic = JSON.parse(atob(other.public_key)) as JsonWebKey;
        if (privateKey) {
          content = await encryptMessage(text, privateKey, theirPublic);
          encrypted = true;
        }
      }
    }

    const message = await messageApi.sendMessage({
      conversationId,
      senderId: user.id,
      content,
      type: 'text',
      encrypted,
      replyToId
    });
    await get().receive(message, 'INSERT');
  },

  // Realtime dispatcher for the global `messages` subscription. Handles
  // inserts (new messages), updates (read receipts, delete-for-everyone) and
  // deletes for every conversation the user participates in — not just the
  // one currently open — so the sidebar, unread badges and notifications stay
  // live across the whole app.
  receiveRealtime: (payload) => {
    const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
    if (event === 'DELETE') {
      const old = payload.old as { id: string; conversation_id: string };
      set((state) => {
        const list = state.byConversation[old.conversation_id];
        if (!list) return state;
        const filtered = list.filter((m) => m.id !== old.id);
        return { byConversation: { ...state.byConversation, [old.conversation_id]: filtered } };
      });
      useConversationStore.getState().clearLastMessageIfMatch(old.conversation_id, old.id);
      return;
    }
    void get().receive(payload.new as Message, event);
  },

  // Single entry point for both optimistic local inserts (send/sendFile) and
  // realtime events. INSERTs update the open chat + sidebar + notify; UPDATEs
  // reflect read receipts and delete-for-everyone.
  receive: async (message, event) => {
    const meId = useAuthStore.getState().user?.id;
    if (!meId) return;

    const decrypted = await decryptIfNeeded(message);
    if (get().deletedForMe.includes(message.id)) return;

    const conversationStore = useConversationStore.getState();
    const activeId = conversationStore.activeId;
    const isActive = activeId === message.conversation_id;

    // Reflected changes (read receipts, delete-for-everyone) for a message
    // already in the open conversation.
    if (event === 'UPDATE') {
      set((state) => {
        const list = state.byConversation[message.conversation_id];
        if (!list || !list.some((m) => m.id === message.id)) return state;
        const updated = list.map((m) => (m.id === message.id ? { ...m, ...decrypted } : m));
        return { byConversation: { ...state.byConversation, [message.conversation_id]: updated } };
      });
      const conv = conversationStore.conversations.find((c) => c.id === message.conversation_id);
      if (conv?.lastMessage?.id === message.id) {
        conversationStore.updateLastMessage(message.conversation_id, decrypted);
      }
      return;
    }

    // A brand-new conversation we haven't loaded yet: refresh the list so it
    // appears, then stop (it will be picked up on the next load).
    if (!conversationStore.conversations.some((c) => c.id === message.conversation_id)) {
      void conversationStore.load();
      return;
    }

    if (isActive) {
      set((state) => upsertMessage(state, decrypted));
    }
    conversationStore.applyIncoming(message.conversation_id, decrypted);

    if (message.sender_id === meId) return;
    if (
      conversationStore.conversations.some(
        (c) => c.id === message.conversation_id && useUiStore.getState().isMuted(c.id)
      )
    )
      return;

    const focused = typeof document !== 'undefined' && document.hasFocus();
    // Already looking at this chat — no need to notify.
    if (focused && isActive) return;

    const conversation = conversationStore.conversations.find(
      (c) => c.id === message.conversation_id
    );
    const sender = conversation?.participants.find((p) => p.id === message.sender_id);
    const title =
      sender?.display_name || sender?.username || (conversation?.is_group ? 'New message' : 'LTalk');
    const body = decrypted.content || 'New message';

    // In-app toast always fires; the OS notification only when the app isn't
    // focused, so we never double up.
    useToastStore.getState().push({ title, body, conversationId: message.conversation_id });
    if (!focused) void notify({ title, body, tag: message.conversation_id });
  },

  editMessage: async (messageId, conversationId, newText) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const conversation = useConversationStore.getState().conversations.find((c) => c.id === conversationId);
    let content = newText;
    let encrypted = false;
    if (conversation && !conversation.is_group) {
      const other = conversation.participants.find((p) => p.id !== user.id);
      if (other?.public_key) {
        const privateKey = getPrivateKey();
        const theirPublic = JSON.parse(atob(other.public_key)) as JsonWebKey;
        if (privateKey) {
          content = await encryptMessage(newText, privateKey, theirPublic);
          encrypted = true;
        }
      }
    }

    // Optimistic update so the edit appears instantly.
    set((state) => {
      const list = state.byConversation[conversationId];
      if (!list) return state;
      const updated = list.map((m) =>
        m.id === messageId ? { ...m, content: newText, encrypted, edited: true } : m
      );
      return { byConversation: { ...state.byConversation, [conversationId]: updated } };
    });

    try {
      const msg = await messageApi.editMessage(messageId, content, encrypted);
      const decrypted = await decryptIfNeeded(msg);
      set((state) => {
        const list = state.byConversation[conversationId] ?? [];
        const updated = list.map((m) => (m.id === messageId ? decrypted : m));
        return { byConversation: { ...state.byConversation, [conversationId]: updated } };
      });
      const conv = useConversationStore.getState().conversations.find((c) => c.id === conversationId);
      if (conv?.lastMessage?.id === messageId) {
        useConversationStore.getState().updateLastMessage(conversationId, decrypted);
      }
    } catch {
      useToastStore.getState().push({ body: 'Failed to edit message', variant: 'error' });
    }
  },

  sync: async (conversationId) => {
    const messages = await messageApi.fetchMessages(conversationId);
    const decrypted = await Promise.all(messages.map(decryptIfNeeded));
    const hidden = get().deletedForMe;
    set((state) => {
      const cur = state.byConversation[conversationId] ?? [];
      const byId = new Map(cur.map((m) => [m.id, m]));
      let changed = false;
      for (const m of decrypted) {
        if (hidden.includes(m.id)) continue;
        const prev = byId.get(m.id);
        if (!prev || prev.content !== m.content || prev.is_read !== m.is_read) {
          byId.set(m.id, m);
          changed = true;
        }
      }
      if (!changed) return state;
      const merged = [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
      return {
        byConversation: { ...state.byConversation, [conversationId]: merged }
      };
    });
  },

  hideForMe: async (messageId) => {
    if (get().deletedForMe.includes(messageId)) return;
    // Optimistically hide locally while the server records it account-wide.
    const hidden = [...get().deletedForMe, messageId];
    set((state) => {
      const byConversation = { ...state.byConversation };
      for (const cid of Object.keys(byConversation)) {
        byConversation[cid] = byConversation[cid].filter((m) => m.id !== messageId);
      }
      return { deletedForMe: hidden, byConversation };
    });
    try {
      await messageApi.hideMessageForMe(messageId);
    } catch {
      /* keep local hide; will retry on next load */
    }
  },

  loadDeletedForMe: async () => {
    let hidden: string[] = [];
    try {
      hidden = await messageApi.fetchDeletedMessageIds();
    } catch {
      hidden = get().deletedForMe;
    }
    set((state) => {
      const byConversation = { ...state.byConversation };
      for (const cid of Object.keys(byConversation)) {
        byConversation[cid] = byConversation[cid].filter((m) => !hidden.includes(m.id));
      }
      return { deletedForMe: hidden, byConversation };
    });
  },

  // Local-only hide triggered by a realtime `message_deletions` insert from
  // another device. Mirrors the optimistic part of `hideForMe` without calling
  // the server again (RLS already scopes the event to this user).
  hideForMeRemote: (messageId) => {
    if (get().deletedForMe.includes(messageId)) return;
    const hidden = [...get().deletedForMe, messageId];
    set((state) => {
      const byConversation = { ...state.byConversation };
      for (const cid of Object.keys(byConversation)) {
        byConversation[cid] = byConversation[cid].filter((m) => m.id !== messageId);
      }
      return { deletedForMe: hidden, byConversation };
    });
  },

  markRead: async (conversationId) => {
    const messages = get().byConversation[conversationId] ?? [];
    const last = messages[messages.length - 1];
    if (last) {
      await window.electron.messages.markRead(conversationId, last.id);
    }
    useConversationStore.getState().setUnread(conversationId, 0);
  },

  loadReactions: async (conversationId) => {
    const reactions = await reactionApi.fetchReactions(conversationId);
    set((state) => {
      const next = { ...state.reactionsByMessage };
      for (const r of reactions) {
        const list = next[r.message_id] ?? [];
        next[r.message_id] = [...list.filter((x) => x.user_id !== r.user_id), r];
      }
      return { reactionsByMessage: next };
    });
  },

  // Optimistic toggle, then persists via the API. The realtime subscription
  // reconciles the local map when the change lands.
  toggleReaction: async (messageId, emoji) => {
    const me = useAuthStore.getState().user?.id;
    if (!me) return;
    const current = get().reactionsByMessage[messageId] ?? [];
    const mine = current.find((r) => r.user_id === me);
    let next: Reaction[];
    if (mine && mine.emoji === emoji) {
      next = current.filter((r) => r.user_id !== me);
    } else if (mine) {
      next = current.map((r) => (r.user_id === me ? { ...r, emoji } : r));
    } else {
      next = [...current, { message_id: messageId, user_id: me, emoji, created_at: new Date().toISOString() }];
    }
    set((state) => ({ reactionsByMessage: { ...state.reactionsByMessage, [messageId]: next } }));
    try {
      await reactionApi.setReaction(messageId, emoji);
    } catch {
      useToastStore.getState().push({ body: 'Failed to react', variant: 'error' });
    }
  },

  receiveReaction: (reaction, event) => {
    set((state) => {
      const list = state.reactionsByMessage[reaction.message_id] ?? [];
      let next: Reaction[] = list;
      if (event === 'DELETE') {
        next = list.filter(
          (r) => !(r.user_id === reaction.user_id && r.emoji === reaction.emoji)
        );
      } else {
        next = [...list.filter((r) => r.user_id !== reaction.user_id), reaction];
      }
      return { reactionsByMessage: { ...state.reactionsByMessage, [reaction.message_id]: next } };
    });
  },

  notifyTyping: (conversationId) => {
    supabase.channel(`conversation:${conversationId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { conversationId }
    });
  },

  subscribe: () => {
    // Single global channel for every conversation the user belongs to. RLS
    // already restricts delivered rows to the user's own conversations, so we
    // don't need a per-conversation filter.
    const channel = supabase
      .channel('realtime:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          get().receiveRealtime(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
