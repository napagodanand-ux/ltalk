import { create } from 'zustand';
import type { ThemeName } from '../../../src/shared/types';

type Panel = 'chats' | 'friends' | 'settings';

interface UiState {
  theme: ThemeName;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  searchOpen: boolean;
  newConversationOpen: boolean;
  newConversationMode: 'dm' | 'group';
  activePanel: Panel;
  notifOnboarding: boolean;
  forwardContent: string | null;
  online: boolean;
  setOnline: (value: boolean) => void;
  splashVisible: boolean;
  setSplashVisible: (value: boolean) => void;
  updateAvailable: { version: string; forced: boolean } | null;
  setUpdateAvailable: (value: { version: string; forced: boolean } | null) => void;
  updateReady: boolean;
  setUpdateReady: (value: boolean) => void;
  updateProgress: number | null;
  setUpdateProgress: (value: number | null) => void;
  setForwardContent: (content: string | null) => void;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setRightPanel: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setNewConversationOpen: (open: boolean, mode?: 'dm' | 'group') => void;
  setActivePanel: (panel: Panel) => void;
  setNotifOnboarding: (open: boolean) => void;
  muted: string[];
  toggleMute: (conversationId: string) => void;
  isMuted: (conversationId: string) => boolean;
  applyTheme: () => void;
}

async function persistTheme(theme: ThemeName): Promise<void> {
  try {
    await window.electron.storage.set('app.theme', theme);
  } catch {
    /* storage unavailable */
  }
}

async function persistMuted(muted: string[]): Promise<void> {
  try {
    await window.electron.storage.set('app.muted', muted);
  } catch {
    /* storage unavailable */
  }
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'dark',
  sidebarCollapsed: false,
  rightPanelOpen: false,
  searchOpen: false,
  newConversationOpen: false,
  newConversationMode: 'dm',
  activePanel: 'chats',
  notifOnboarding: false,
  forwardContent: null,
  online: true,
  splashVisible: true,
  updateAvailable: null,
  updateReady: false,
  updateProgress: null,
  muted: [],

  setTheme: (theme) => {
    set({ theme });
    persistTheme(theme);
    get().applyTheme();
  },

  toggleTheme: () => {
    const next: ThemeName = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setRightPanel: (open) => set({ rightPanelOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setNewConversationOpen: (open, mode) =>
    set((state) => ({
      newConversationOpen: open,
      newConversationMode: mode ?? (open ? state.newConversationMode : 'dm')
    })),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setNotifOnboarding: (open) => set({ notifOnboarding: open }),
  setOnline: (value) => set({ online: value }),
  setSplashVisible: (value) => set({ splashVisible: value }),
  setUpdateAvailable: (value) => set({ updateAvailable: value }),
  setUpdateReady: (value) => set({ updateReady: value }),
  setUpdateProgress: (value) => set({ updateProgress: value }),
  setForwardContent: (content) => set({ forwardContent: content }),

  toggleMute: (conversationId) => {
    const muted = get().muted;
    const next = muted.includes(conversationId)
      ? muted.filter((id) => id !== conversationId)
      : [...muted, conversationId];
    set({ muted: next });
    persistMuted(next);
  },

  isMuted: (conversationId) => get().muted.includes(conversationId),

  applyTheme: () => {
    const root = document.documentElement;
    if (get().theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
    }
  }
}));
