import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';

import { TitleBar } from './TitleBar';
import Sidebar from './Sidebar';
import RightPanel from './RightPanel';
import { NotificationOnboarding } from '../notifications/NotificationOnboarding';

import { supabase } from '../../lib/supabase';
import type { Profile, Reaction } from '../../../src/shared/types';
import { useUiStore } from '../../stores/uiStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useMessageStore } from '../../stores/messageStore';
import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { updatePresence } from '../../lib/api/profile';
import { Toaster } from '../Toaster';
import { RestoreKeysModal } from '../auth/RestoreKeysModal';
import { SearchModal } from '../chat/SearchModal';
import { APP_MENU_CHANNELS } from '../../lib/constants';

export function AppLayout() {
  const navigate = useNavigate();
  const activeId = useConversationStore((s) => s.activeId);
  const conversations = useConversationStore((s) => s.conversations);
  const loadConversations = useConversationStore((s) => s.load);
  const loadFriends = useFriendStore((s) => s.load);
  const setNewConversationOpen = useUiStore((s) => s.setNewConversationOpen);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setRightPanel = useUiStore((s) => s.setRightPanel);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  useEffect(() => {
    void loadConversations();
    void loadFriends();
    void useMessageStore.getState().loadDeletedForMe();
  }, [loadConversations, loadFriends]);

  // Presence: publish online/away/offline and keep "online" fresh with a
  // heartbeat so peers can show an accurate status. Drives the live status
  // dots in the sidebar and friends list via the realtime profiles channel.
  useEffect(() => {
    const setStatus = (status: 'online' | 'away' | 'offline') => {
      void updatePresence(status);
    };
    setStatus('online');
    const onFocus = () => {
      setStatus('online');
      const aid = useConversationStore.getState().activeId;
      if (aid) void useMessageStore.getState().markRead(aid);
    };
    const onBlur = () => setStatus('away');
    const onVisibility = () => setStatus(document.hidden ? 'away' : 'online');
    const onUnload = () => setStatus('offline');
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);
    // pagehide fires reliably on mobile/tab close where beforeunload can be skipped.
    window.addEventListener('pagehide', onUnload);
    const heartbeat = setInterval(() => {
      const me = useAuthStore.getState().user?.id;
      if (me) {
        void supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', me);
      }
    }, 60000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
      clearInterval(heartbeat);
      setStatus('offline');
    };
  }, []);

  useEffect(() => {
    const muted = useUiStore.getState().muted;
    const unread = conversations.reduce(
      (sum, c) => (muted.includes(c.id) ? sum : sum + c.unreadCount),
      0
    );
    window.electron?.tray.setBadge(unread);
  }, [conversations]);

  useEffect(() => {
    const electron = window.electron;
    if (!electron) return;
    const offNew = electron.on(APP_MENU_CHANNELS.newConversation, () =>
      setNewConversationOpen(true)
    );
    const offSearch = electron.on(APP_MENU_CHANNELS.search, () => setSearchOpen(true));
    const offSettings = electron.on(APP_MENU_CHANNELS.settings, () => navigate('/app/settings'));
    const offTheme = electron.on(APP_MENU_CHANNELS.toggleTheme, () => toggleTheme());
    const offUpdates = electron.on(APP_MENU_CHANNELS.checkUpdates, () =>
      electron.updates.check()
    );
    return () => {
      offNew();
      offSearch();
      offSettings();
      offTheme();
      offUpdates();
    };
  }, [setNewConversationOpen, setSearchOpen, toggleTheme, navigate]);

  // Global, app-wide realtime. A single channel receives every message event
  // for the user's conversations (RLS-scoped) so the sidebar, unread badges and
  // notifications stay live regardless of which chat is open. Profile changes
  // (avatar, name, status) propagate everywhere they appear.
  useEffect(() => {
    const messageUnsub = useMessageStore.getState().subscribe();

    const profilesChannel = supabase
      .channel('realtime:profiles')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const profile = payload.new as unknown as Profile;
          useFriendStore.getState().updateProfile(profile);
          useConversationStore.getState().updateParticipantProfile(profile);
        }
      )
      .subscribe();

    const deletionsChannel = supabase
      .channel('realtime:deletions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_deletions' },
        (payload) => {
          const row = payload.new as { message_id: string };
          useMessageStore.getState().hideForMeRemote(row.message_id);
        }
      )
      .subscribe();

    const reactionsChannel = supabase
      .channel('realtime:reactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        (payload) => {
          const event = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
          const row =
            event === 'DELETE'
              ? (payload.old as unknown as Reaction)
              : (payload.new as unknown as Reaction);
          useMessageStore.getState().receiveReaction(row, event);
        }
      )
      .subscribe();

    return () => {
      messageUnsub();
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(deletionsChannel);
      supabase.removeChannel(reactionsChannel);
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const messageStore = useMessageStore.getState();
    // Await load() before markRead so byConversation is populated (markRead needs
    // the last message) — otherwise the first markRead is a no-op and the read
    // receipt never reaches the database.
    void (async () => {
      await messageStore.load(activeId);
      void messageStore.loadReactions(activeId);
      await messageStore.markRead(activeId);
    })();

    // Realtime (WebSocket) is unreliable inside the Electron runtime, so poll the
    // active conversation as a guaranteed fallback for new messages / read receipts.
    const poll = setInterval(() => {
      const store = useMessageStore.getState();
      void store.sync(activeId);
      void store.markRead(activeId);
    }, 4000);

    // Typing indicator for the open conversation.
    const typingChannel = supabase
      .channel(`conversation:${activeId}`)
      .on('broadcast', { event: 'typing' }, () => {
        useMessageStore.setState((state) => ({
          typing: { ...state.typing, [activeId]: true }
        }));
        setTimeout(() => {
          useMessageStore.setState((state) => ({
            typing: { ...state.typing, [activeId]: false }
          }));
        }, 2000);
      })
      .subscribe();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRightPanel(false);
      if ((event.ctrlKey || event.metaKey) && event.key === ',') navigate('/app/settings');
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setNewConversationOpen(true);
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === 'Delete'
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(poll);
      supabase.removeChannel(typingChannel);
    };
  }, [activeId, navigate, setRightPanel, setSearchOpen, setNewConversationOpen]);

  return (
    <div className="flex h-full flex-col bg-bg">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col bg-bg">
          <Outlet />
        </main>
        <RightPanel />
      </div>
      <NotificationOnboarding />
      <Toaster />
      <RestoreKeysModal />
      <SearchModal />
    </div>
  );
}
