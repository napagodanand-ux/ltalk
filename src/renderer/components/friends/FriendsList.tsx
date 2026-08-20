import { Check, X, Eye, UserX, UserMinus, MessageCircle, Search, UserPlus } from 'lucide-react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useUiStore } from '../../stores/uiStore';
import * as conversationsApi from '../../lib/api/conversations';
import * as profilesApi from '../../lib/api/profiles';
import { ROUTES } from '../../lib/constants';
import { effectiveStatus, debounce } from '../../lib/helpers';
import type { Profile } from '../../../../src/shared/types';
import { Avatar, ContextMenu, ContextMenuItem, IconButton, Input, Spinner } from '../ui';

export function FriendsList() {
  const navigate = useNavigate();
  const friends = useFriendStore((s) => s.friends);
  const pending = useFriendStore((s) => s.pending);
  const load = useFriendStore((s) => s.load);
  const respond = useFriendStore((s) => s.respond);
  const block = useFriendStore((s) => s.block);
  const remove = useFriendStore((s) => s.remove);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const setRightPanel = useUiStore((s) => s.setRightPanel);

  // Inline "add friend" search so users can send requests directly from the
  // Friends tab (previously there was no way to add a friend from here).
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<Profile[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  const runAddSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setAddResults([]);
        return;
      }
      setAddLoading(true);
      try {
        const found = await profilesApi.searchUsers(q.trim());
        const known = new Set([
          ...friends.map((f) => f.id),
          ...pending.map((p) => p.profile.id)
        ]);
        setAddResults(found.filter((p) => !known.has(p.id)));
      } finally {
        setAddLoading(false);
      }
    },
    [friends, pending]
  );

  const debouncedSearch = useMemo(() => debounce((q: string) => void runAddSearch(q), 300), [runAddSearch]);

  useEffect(() => {
    debouncedSearch(addQuery);
  }, [addQuery, debouncedSearch]);

  // Opens (or creates) a 1:1 conversation with a friend and jumps to the chat.
  const openChat = async (friend: Profile) => {
    const me = useAuthStore.getState().user?.id;
    const existing = useConversationStore
      .getState()
      .conversations.find(
        (c) =>
          !c.is_group &&
          c.participants.some((p) => p.id === friend.id) &&
          c.participants.some((p) => p.id === me)
      );
    if (existing) {
      useConversationStore.getState().select(existing.id);
    } else {
      const conversation = await conversationsApi.createConversation([friend.id]);
      useConversationStore.getState().upsert({
        ...conversation,
        participants: [friend],
        lastMessage: null,
        unreadCount: 0
      });
      useConversationStore.getState().select(conversation.id);
    }
    navigate(ROUTES.app);
  };

  // Opens the friend's details panel. Requires a conversation to exist (the
  // details view is keyed off the active conversation's other participant), so
  // we reuse/resolve one and select it before showing the right panel.
  const viewProfile = async (friend: Profile) => {
    const me = useAuthStore.getState().user?.id;
    const existing = useConversationStore
      .getState()
      .conversations.find(
        (c) =>
          !c.is_group &&
          c.participants.some((p) => p.id === friend.id) &&
          c.participants.some((p) => p.id === me)
      );
    let id: string;
    if (existing) {
      id = existing.id;
    } else {
      const conversation = await conversationsApi.createConversation([friend.id]);
      useConversationStore.getState().upsert({
        ...conversation,
        participants: [friend],
        lastMessage: null,
        unreadCount: 0
      });
      id = conversation.id;
    }
    useConversationStore.getState().select(id);
    setRightPanel(true);
  };

  useEffect(() => {
    if (friends.length === 0 && pending.length === 0) {
      void load();
    }
  }, [friends.length, pending.length, load]);

  return (
    <div className="py-1">
      <div className="px-3 pt-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted" />
          <Input
            placeholder="Add friend by username…"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        {addLoading && (
          <div className="flex justify-center py-2">
            <Spinner size={16} />
          </div>
        )}
        {!addLoading && addQuery.trim() !== '' && addResults.length === 0 && (
          <div className="py-2 text-center text-xs text-content-muted">No users found</div>
        )}
        {!addLoading &&
          addResults.map((profile) => (
            <div key={profile.id} className="flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-surface-hover">
              <Avatar
                src={profile.avatar_url}
                name={profile.display_name || profile.username}
                size={28}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-content">
                  {profile.display_name || profile.username}
                </div>
                <div className="truncate text-xs text-content-muted">@{profile.username}</div>
              </div>
              <button
                type="button"
                disabled={requested[profile.id]}
                onClick={async () => {
                  setRequested((r) => ({ ...r, [profile.id]: true }));
                  await sendRequest(profile.id);
                  setAddQuery('');
                  setAddResults([]);
                }}
                className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-60"
              >
                <UserPlus size={12} />
                {requested[profile.id] ? 'Sent' : 'Add'}
              </button>
            </div>
          ))}
      </div>

      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
        Requests{pending.length > 0 ? ` (${pending.length})` : ''}
      </div>
      {pending.length === 0 ? (
        <div className="px-3 py-1 text-xs text-content-muted">No pending requests</div>
      ) : (
        pending.map((fr) => (
          <div key={fr.id} className="flex items-center gap-2 px-3 py-2">
            <Avatar
              src={fr.profile.avatar_url}
              name={fr.profile.display_name || fr.profile.username}
              size={32}
              status={effectiveStatus(fr.profile.status, fr.profile.last_seen)}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-content">
                {fr.profile.display_name || fr.profile.username}
              </div>
              <div className="truncate text-xs text-content-muted">@{fr.profile.username}</div>
            </div>
            <IconButton label="Accept" onClick={() => void respond(fr.id, true)}>
              <Check size={16} />
            </IconButton>
            <IconButton label="Reject" onClick={() => void respond(fr.id, false)}>
              <X size={16} />
            </IconButton>
          </div>
        ))
      )}

      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
        Friends
      </div>
      {friends.length === 0 ? (
        <div className="px-3 py-1 text-xs text-content-muted">No friends yet</div>
      ) : (
        friends.map((f) => (
          <ContextMenu
            key={f.id}
            trigger={
              <div className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-hover">
                <Avatar
                  src={f.avatar_url}
                  name={f.display_name || f.username}
                  size={32}
                  status={effectiveStatus(f.status, f.last_seen)}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm text-content">
                    {f.display_name || f.username}
                  </div>
                  <div className="truncate text-xs text-content-muted">@{f.username}</div>
                </div>
              </div>
            }
          >
            <ContextMenuItem onSelect={() => void openChat(f)}>
              <MessageCircle size={14} /> Message
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void viewProfile(f)}>
              <Eye size={14} /> View Profile
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void remove(f.id)}>
              <UserMinus size={14} /> Remove
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void block(f.id)}>
              <UserX size={14} /> Block
            </ContextMenuItem>
          </ContextMenu>
        ))
      )}
    </div>
  );
}
