import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '../../../../src/shared/types';
import { useNavigate } from 'react-router-dom';

import { useUiStore } from '../../stores/uiStore';
import { useConversationStore, type ConversationView } from '../../stores/conversationStore';
import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import * as profilesApi from '../../lib/api/profiles';
import * as conversationsApi from '../../lib/api/conversations';
import { ROUTES } from '../../lib/constants';
import { Avatar, Button, Input, Modal, ModalContent, Spinner } from '../ui';
import { debounce } from '../../lib/helpers';

export function NewConversationModal() {
  const navigate = useNavigate();
  const open = useUiStore((s) => s.newConversationOpen);
  const setOpen = useUiStore((s) => s.setNewConversationOpen);
  const select = useConversationStore((s) => s.select);
  const upsert = useConversationStore((s) => s.upsert);
  const friends = useFriendStore((s) => s.friends);
  const sendRequest = useFriendStore((s) => s.sendRequest);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

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
    if (!open) {
      setQuery('');
      setResults([]);
      useUiStore.getState().setForwardContent(null);
    }
  }, [open]);

  const isFriend = (id: string) => friends.some((f) => f.id === id);

  const handleStart = async (profile: Profile) => {
    if (!isFriend(profile.id)) return;
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

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalContent title="New conversation">
        <Input
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="mt-3 max-h-[300px] overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="py-4 text-center text-sm text-content-muted">No users found</div>
          )}
          {!loading &&
            results.map((profile) => {
              const friend = isFriend(profile.id);
              return (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-hover"
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
                  {friend ? (
                    <Button variant="primary" className="h-8" onClick={() => void handleStart(profile)}>
                      Start chat
                    </Button>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <Button variant="outline" className="h-8" disabled>
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
                  )}
                </div>
              );
            })}
        </div>
      </ModalContent>
    </Modal>
  );
}
