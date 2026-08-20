import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Profile } from '../../../../src/shared/types';
import { NON_FRIEND_MESSAGE_LIMIT } from '../../../../src/shared/constants';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

import { useUiStore } from '../../stores/uiStore';
import { useConversationStore, type ConversationView } from '../../stores/conversationStore';
import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { useToastStore } from '../../stores/toastStore';
import * as profilesApi from '../../lib/api/profiles';
import * as conversationsApi from '../../lib/api/conversations';
import * as groupKeysApi from '../../lib/api/groupKeys';
import { ROUTES } from '../../lib/constants';
import { Avatar, Button, Input, Modal, ModalContent, Spinner } from '../ui';
import { debounce } from '../../lib/helpers';

function UserRow({ profile, action }: { profile: Profile; action: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-hover">
      <Avatar
        src={profile.avatar_url}
        name={profile.display_name || profile.username}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-content">
          {profile.display_name || profile.username}
        </div>
        <div className="truncate text-xs text-content-muted">@{profile.username}</div>
      </div>
      {action}
    </div>
  );
}

export function NewConversationModal() {
  const navigate = useNavigate();
  const open = useUiStore((s) => s.newConversationOpen);
  const setOpen = useUiStore((s) => s.setNewConversationOpen);
  const select = useConversationStore((s) => s.select);
  const upsert = useConversationStore((s) => s.upsert);
  const loadConversations = useConversationStore((s) => s.load);
  const friends = useFriendStore((s) => s.friends);
  const sendRequest = useFriendStore((s) => s.sendRequest);
  const pushToast = useToastStore((s) => s.push);

  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const runSearch = useCallback(
    debounce((q: string) => {
      void (async () => {
        if (!q.trim()) {
          setResults([]);
          return;
        }
        setLoading(true);
        try {
          const found = await profilesApi.searchUsers(q.trim());
          setResults(found);
        } finally {
          setLoading(false);
        }
      })();
    }, 300),
    []
  );

  useEffect(() => {
    runSearch(query);
  }, [query, runSearch]);

  useEffect(() => {
    if (open) {
      setMode(useUiStore.getState().newConversationMode);
      setQuery('');
      setResults([]);
      setGroupName('');
      setSelected([]);
      useUiStore.getState().setForwardContent(null);
    }
  }, [open]);

  const isFriend = (id: string) => friends.some((f) => f.id === id);

  const handleStart = async (profile: Profile) => {
    const me = useAuthStore.getState().user?.id;
    const existing = useConversationStore
      .getState()
      .conversations.find(
        (c) =>
          !c.is_group &&
          c.participants.some((p) => p.id === profile.id) &&
          c.participants.some((p) => p.id === me)
      );

    let targetId: string;
    if (existing) {
      targetId = existing.id;
      select(existing.id);
    } else {
      const conversation = await conversationsApi.createConversation([profile.id]);
      const view: ConversationView = {
        ...conversation,
        participants: [profile],
        lastMessage: null,
        unreadCount: 0
      };
      upsert(view);
      targetId = conversation.id;
      select(conversation.id);
    }

    const forward = useUiStore.getState().forwardContent;
    if (forward) {
      await useMessageStore.getState().send(targetId, forward);
      useUiStore.getState().setForwardContent(null);
    }
    setOpen(false);
    navigate(ROUTES.app);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateGroup = async () => {
    if (!selected.length) return;
    const me = useAuthStore.getState().user?.id;
    if (!me) return;
    setCreating(true);
    try {
      const conversation = await conversationsApi.createConversation(selected, {
        isGroup: true,
        name: groupName.trim() || null
      });
      await groupKeysApi.setupGroupKeys(conversation.id, [me, ...selected]);
      await loadConversations();
      select(conversation.id);
      setOpen(false);
      navigate(ROUTES.app);
    } catch {
      pushToast({ body: 'Failed to create group', variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalContent title={mode === 'dm' ? 'New chat' : 'New group'}>
        {mode === 'dm' ? (
          <>
            <Input
              placeholder="Search users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <p className="mt-2 text-xs text-content-muted">
              You can message anyone. Non-friends are limited to {NON_FRIEND_MESSAGE_LIMIT} messages until you're friends.
            </p>
            <div className="mt-3 max-h-[300px] overflow-y-auto">
              {loading && (
                <div className="flex justify-center py-4">
                  <Spinner />
                </div>
              )}
              {!loading && query.trim() === '' && (
                <>
                  {friends.length === 0 ? (
                    <div className="py-4 text-center text-sm text-content-muted">No friends yet — search to add some</div>
                  ) : (
                    friends.map((profile) => (
                      <UserRow
                        key={profile.id}
                        profile={profile}
                        action={
                          <Button variant="primary" className="h-8" onClick={() => void handleStart(profile)}>
                            Start chat
                          </Button>
                        }
                      />
                    ))
                  )}
                </>
              )}
              {!loading && query.trim() !== '' && results.length === 0 && (
                <div className="py-4 text-center text-sm text-content-muted">No users found</div>
              )}
              {!loading &&
                query.trim() !== '' &&
                results.map((profile) => {
                  const friend = isFriend(profile.id);
                  return (
                    <UserRow
                      key={profile.id}
                      profile={profile}
                      action={
                        friend ? (
                          <Button variant="primary" className="h-8" onClick={() => void handleStart(profile)}>
                            Start chat
                          </Button>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <Button variant="primary" className="h-8" onClick={() => void handleStart(profile)}>
                              Start chat
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => void sendRequest(profile.id)}
                            >
                              Send friend request
                            </Button>
                          </div>
                        )
                      }
                    />
                  );
                })}
            </div>
          </>
        ) : (
          <>
            <Input
              placeholder="Group name (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <div className="mt-3 max-h-[260px] overflow-y-auto">
              {friends.length === 0 && (
                <div className="py-4 text-center text-sm text-content-muted">
                  Add friends first to create a group
                </div>
              )}
              {friends.map((profile) => {
                const checked = selected.includes(profile.id);
                return (
                  <button
                    type="button"
                    key={profile.id}
                    onClick={() => toggleSelect(profile.id)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-hover"
                  >
                    <Avatar
                      src={profile.avatar_url}
                      name={profile.display_name || profile.username}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-content">
                        {profile.display_name || profile.username}
                      </div>
                      <div className="truncate text-xs text-content-muted">@{profile.username}</div>
                    </div>
                    <span
                      className={
                        'flex h-5 w-5 items-center justify-center rounded-full border ' +
                        (checked
                          ? 'border-primary bg-primary text-white'
                          : 'border-edge text-transparent')
                      }
                    >
                      <Check size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              variant="primary"
              className="mt-3 h-9 w-full"
              disabled={!selected.length || creating}
              onClick={() => void handleCreateGroup()}
            >
              {creating ? 'Creating…' : `Create group (${selected.length})`}
            </Button>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
