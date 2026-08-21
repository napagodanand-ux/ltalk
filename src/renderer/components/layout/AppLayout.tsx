import { useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

import { TitleBar } from './TitleBar';
import Sidebar from './Sidebar';
import RightPanel from './RightPanel';
import { NotificationOnboarding } from '../notifications/NotificationOnboarding';
import { NewConversationModal } from '../friends/NewConversationModal';

import { supabase } from '../../lib/supabase';
import type { Profile, Reaction } from '../../../src/shared/types';
import { useUiStore } from '../../stores/uiStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useMessageStore, refreshGroupKey } from '../../stores/messageStore';
import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { updatePresence } from '../../lib/api/profile';
import { Toaster } from '../Toaster';
import { RestoreKeysModal } from '../auth/RestoreKeysModal';
import { SearchModal } from '../chat/SearchModal';
import { OfflineOverlay } from './OfflineOverlay';
import { UpdateSplash } from './UpdateSplash';
import { UpdateDialog } from './UpdateDialog';
import { CallOverlay } from '../call/CallOverlay';
import { IncomingCallDialog } from '../call/IncomingCallDialog';
import { callManager } from '../../lib/call';
import { APP_MENU_CHANNELS } from '../../lib/constants';
import { compareVersions, cn } from '../../lib/helpers';
import { useIsMobile } from '../../lib/hooks';

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = useConversationStore((s) => s.activeId);
  const conversations = useConversationStore((s) => s.conversations);
  const isMobile = useIsMobile();
  const isIndex = location.pathname === '/app';
  // On mobile the sidebar (conversation/friend list) and the active chat are
  // shown one-at-a-time: the list when no conversation is open (or on a sub
  // route like settings/profile), the chat otherwise. On desktop they sit
  // side-by-side.
  const showSidebar = !isMobile || (isIndex && !activeId);
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

  // Subscribe the always-on Realtime channel used for call signalling so we can
  // receive incoming calls even when no chat is open.
  useEffect(() => {
    callManager.init();
  }, []);

  // Connectivity: track navigator.onLine plus a periodic reachability ping so a
  // "connected to Wi-Fi but no internet" state is also detected. Drives the
  // offline overlay; local reading/scrolling stays usable underneath it.
  useEffect(() => {
    const setOnline = useUiStore.getState().setOnline;
    const update = (value: boolean) => setOnline(value);

    update(navigator.onLine);
    const onOnline = () => update(true);
    const onOffline = () => update(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    let cancelled = false;
    const ping = async () => {
      if (!navigator.onLine) {
        update(false);
        return;
      }
      try {
        const { error } = await supabase.from('profiles').select('id').limit(1);
        if (!cancelled) update(!error);
      } catch {
        if (!cancelled) update(false);
      }
    };
    const pingInterval = setInterval(ping, 20000);
    ping();

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(pingInterval);
    };
  }, []);

  // Auto-updater: drive the launch splash and the update dialog. On launch the
  // splash stays up until the first updater event (or a short timeout). When an
  // update is available we decide forced-vs-optional: skipping records the
  // version so the NEXT release is forced (skip-cascade), and a server-side
  // minimum version can also force the update.
  useEffect(() => {
    const electron = window.electron;
    if (!electron?.isElectron) {
      useUiStore.getState().setSplashVisible(false);
      return;
    }
    let splashHidden = false;
    const hideSplash = () => {
      if (!splashHidden) {
        splashHidden = true;
        useUiStore.getState().setSplashVisible(false);
      }
    };
    const fallback = setTimeout(hideSplash, 4000);

    let currentVersion = '';
    void electron.app.version().then((v) => {
      currentVersion = v;
    });

    let receivedEvent = false;
    // The main process also checks on launch; if that completes before this
    // listener attaches we'd miss it. Re-check shortly after mount so the
    // splash/update dialog are driven reliably by an event we actually see.
    const recheck = setTimeout(() => {
      if (!receivedEvent) void electron.updates.check();
    }, 1500);

    const off = electron.on('updater:event', async (...args: unknown[]) => {
      const data = args[0] as { event: string; payload: unknown };
      const { event, payload } = data;
      if (
        ['checking', 'available', 'not-available', 'error', 'downloaded'].includes(event)
      ) {
        receivedEvent = true;
        hideSplash();
      }
      if (event === 'available') {
        const info = (payload ?? {}) as { version?: string };
        const version = info.version ?? '';
        let forced = false;
        try {
          const skipped = (await electron.storage.get('app.skippedUpdate')) as string | null;
          if (skipped) forced = true;
        } catch {
          /* ignore */
        }
        try {
          const policy = await fetch(
            'https://napagodanand-ux.github.io/ltalk/update-policy.json',
            { cache: 'no-store' }
          ).then((r) => (r.ok ? r.json() : null));
          if (policy?.minVersion && currentVersion && compareVersions(currentVersion, policy.minVersion) < 0) {
            forced = true;
          }
        } catch {
          /* offline / no policy — non-fatal */
        }
        useUiStore.getState().setUpdateAvailable({ version, forced });
        if (forced) void electron.updates.download();
      } else if (event === 'not-available') {
        useUiStore.getState().setUpdateAvailable(null);
      } else if (event === 'progress') {
        const p = (payload ?? {}) as { percent?: number };
        useUiStore.getState().setUpdateProgress(Math.round(p.percent ?? 0));
      } else if (event === 'downloaded') {
        const info = (payload ?? {}) as { version?: string };
        useUiStore.getState().setUpdateReady(true);
        useUiStore.getState().setUpdateProgress(100);
        if (info?.version) {
          const cur = useUiStore.getState().updateAvailable;
          if (cur) useUiStore.getState().setUpdateAvailable({ ...cur, version: info.version });
        }
      } else if (event === 'error') {
        useUiStore.getState().setUpdateProgress(null);
      }
    });

    return () => {
      clearTimeout(fallback);
      clearTimeout(recheck);
      off();
    };
  }, []);

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

  // Global, app-wide realtime. Every channel below is RLS-scoped to the current
  // user, so it only ever receives rows the user is allowed to see. This keeps
  // the sidebar, unread badges, presence, friend requests, reactions and
  // notifications live regardless of which chat is open.
  useEffect(() => {
    if (!useAuthStore.getState().user) return;

    const channels: Array<ReturnType<typeof supabase.channel>> = [];

    // Messages: new messages, read receipts and delete-for-everyone for any
    // conversation the user belongs to.
    const messagesChannel = supabase
      .channel('realtime:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => useMessageStore.getState().receiveRealtime(payload)
      )
      .subscribe();
    channels.push(messagesChannel);

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
    channels.push(profilesChannel);

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
    channels.push(deletionsChannel);

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
    channels.push(reactionsChannel);

    // Group-key changes (rotation on member removal/addition). Remaining members
    // refresh their cached key and re-decrypt the open conversation so history
    // stays readable after the key changes.
    const keysChannel = supabase
      .channel('realtime:groupkeys')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_keys' },
        (payload) => {
          const row = ((payload.new ?? payload.old) || {}) as { conversation_id?: string };
          const cid = row.conversation_id;
          if (!cid) return;
          void refreshGroupKey(cid);
          const activeId = useConversationStore.getState().activeId;
          if (activeId === cid) void useMessageStore.getState().load(cid);
        }
      )
      .subscribe();
    channels.push(keysChannel);

    // Friend requests / accepts / blocks. Any change to a friendship that
    // involves the current user refreshes the friends + pending lists so the
    // Friends tab and request notifications update instantly.
    const friendshipsChannel = supabase
      .channel('realtime:friendships')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            user_id?: string;
            friend_id?: string;
          };
          const me = useAuthStore.getState().user?.id;
          if (!me) return;
          if (row.user_id !== me && row.friend_id !== me) return;
          void useFriendStore.getState().load();
        }
      )
      .subscribe();
    channels.push(friendshipsChannel);

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
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

    // Typing indicator for the open conversation. The sender broadcasts on the
    // same channel name (AppLayout subscribes it for the active conversation),
    // so we receive their "typing" events here. Ignore our own echo.
    let typingTimeout: ReturnType<typeof setTimeout> | undefined;
    const typingChannel = supabase
      .channel(`conversation:${activeId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.senderId === useAuthStore.getState().user?.id) return;
        useMessageStore.setState((state) => ({
          typing: { ...state.typing, [activeId]: true }
        }));
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
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
      {!isMobile && <TitleBar />}
      <div className="flex min-h-0 flex-1">
        <Sidebar
          className={cn(
            isMobile ? (showSidebar ? 'w-full' : 'hidden') : 'w-[280px]'
          )}
        />
        <main
          className={cn(
            'min-w-0 flex-1 flex-col bg-bg',
            !isMobile || !showSidebar ? 'flex' : 'hidden'
          )}
        >
          <Outlet />
        </main>
        <RightPanel />
      </div>
      <NotificationOnboarding />
      <Toaster />
      <RestoreKeysModal />
      <SearchModal />
      <NewConversationModal />
      <OfflineOverlay />
      <UpdateDialog />
      <UpdateSplash />
      <IncomingCallDialog />
      <CallOverlay />
    </div>
  );
}
