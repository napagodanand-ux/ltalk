import { Check, X, Eye, UserX, UserMinus, MessageCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { useConversationStore } from '../../stores/conversationStore';
import * as conversationsApi from '../../lib/api/conversations';
import { ROUTES } from '../../lib/constants';
import type { Profile } from '../../../../src/shared/types';
import { Avatar, ContextMenu, ContextMenuItem, IconButton } from '../ui';

export function FriendsList() {
  const navigate = useNavigate();
  const friends = useFriendStore((s) => s.friends);
  const pending = useFriendStore((s) => s.pending);
  const load = useFriendStore((s) => s.load);
  const respond = useFriendStore((s) => s.respond);
  const block = useFriendStore((s) => s.block);

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

  useEffect(() => {
    if (friends.length === 0 && pending.length === 0) {
      void load();
    }
  }, [friends.length, pending.length, load]);

  return (
    <div className="py-1">
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
              status={fr.profile.status}
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
                <Avatar src={f.avatar_url} name={f.display_name || f.username} size={32} status={f.status} />
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
            <ContextMenuItem>
              <Eye size={14} /> View Profile
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void block(f.id)}>
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
