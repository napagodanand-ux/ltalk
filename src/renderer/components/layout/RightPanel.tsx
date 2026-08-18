import { useState } from 'react';

import { X, UserPlus, UserX, Eraser, Check } from 'lucide-react';

import { useUiStore } from '../../stores/uiStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useAuthStore } from '../../stores/authStore';
import { useFriendStore } from '../../stores/friendStore';
import { useMessageStore } from '../../stores/messageStore';
import {
  Avatar,
  IconButton,
  ContextMenu,
  ContextMenuItem,
  Toast,
  ToastProvider,
  ToastViewport,
  Modal,
  ModalContent,
  Button
} from '../ui';
import { relativeTime } from '../../lib/helpers';
import { addParticipants, clearMessages } from '../../lib/api/conversations';
import * as groupKeysApi from '../../lib/api/groupKeys';

export default function RightPanel() {
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const setRightPanel = useUiStore((s) => s.setRightPanel);
  const activeId = useConversationStore((s) => s.activeId);
  const conversation = useConversationStore((s) => (activeId ? s.getById(activeId) : undefined));
  const currentUserId = useAuthStore((s) => s.user?.id);
  const friends = useFriendStore((s) => s.friends);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  if (!rightPanelOpen || !activeId || !conversation) return null;

  const isGroup = conversation.is_group;
  const other = isGroup ? null : conversation.participants.find((p) => p.id !== currentUserId);
  const memberIds = new Set(conversation.participants.map((p) => p.id));
  const candidates = friends.filter((f) => !memberIds.has(f.id));

  const showToast = (message: string) => {
    setToastMsg(message);
    setToastOpen(true);
  };

  const handleBlock = async (id: string) => {
    await window.electron.friendships.block(id);
    showToast('User blocked');
  };

  const handleClearChat = async () => {
    if (!window.confirm('Clear all messages in this conversation?')) return;
    try {
      await clearMessages(activeId);
      useMessageStore.setState((state) => ({
        byConversation: { ...state.byConversation, [activeId]: [] }
      }));
      showToast('Chat cleared');
    } catch {
      showToast('Failed to clear chat');
    }
  };

  const handleAddMembers = async (userId: string) => {
    try {
      await addParticipants(activeId, [userId]);
      await groupKeysApi.addGroupMembers(activeId, [userId]);
      await useConversationStore.getState().load();
      showToast('Member added');
      setAddOpen(false);
    } catch {
      showToast('Failed to add member');
    }
  };

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-edge bg-surface">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <span className="text-sm font-semibold text-content">
          {isGroup ? 'Group info' : 'Contact info'}
        </span>
        <IconButton label="Close" onClick={() => setRightPanel(false)}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="flex flex-col items-center gap-3 px-4 py-6">
        {isGroup ? (
          <Avatar src={conversation.group_avatar_url} name={conversation.name || 'Group'} size={72} />
        ) : (
          <Avatar
            src={other?.avatar_url ?? null}
            name={other?.display_name || other?.username || 'Unknown'}
            size={72}
          />
        )}
        <div className="text-center">
          <div className="text-base font-semibold text-content">
            {isGroup ? conversation.name || 'Group' : other?.display_name || other?.username}
          </div>
          {!isGroup && other && <div className="text-xs text-content-muted">@{other.username}</div>}
          {!isGroup && other && (
            <div className="mt-1 text-xs text-content-secondary">
              Last seen {relativeTime(other.last_seen)}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-edge px-4 py-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
          {isGroup ? 'Members' : 'Actions'}
        </div>
        {isGroup ? (
          <div className="space-y-2">
            <Button variant="ghost" className="w-full justify-start" onClick={() => setAddOpen(true)}>
              <UserPlus size={16} /> Add members
            </Button>
            {conversation.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1">
                <Avatar src={p.avatar_url} name={p.display_name || p.username} size={28} />
                <span className="truncate text-sm text-content">
                  {p.display_name || p.username}
                </span>
              </div>
            ))}
          </div>
        ) : (
          other && (
            <ContextMenu
              trigger={
                <button className="flex w-full items-center justify-center gap-2 rounded-md border border-edge px-3 py-2 text-sm text-content hover:bg-surface-hover">
                  Options
                </button>
              }
            >
              <ContextMenuItem onSelect={() => void handleBlock(other.id)}>
                <UserX size={14} /> Block
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => void handleClearChat()}>
                <Eraser size={14} /> Clear chat
              </ContextMenuItem>
            </ContextMenu>
          )
        )}
      </div>

      <Modal open={addOpen} onOpenChange={setAddOpen}>
        <ModalContent title="Add members">
          {candidates.length === 0 ? (
            <p className="text-sm text-content-secondary">No friends available to add.</p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {candidates.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => void handleAddMembers(friend.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-hover"
                >
                  <Avatar src={friend.avatar_url} name={friend.display_name || friend.username} size={28} />
                  <span className="flex-1 truncate text-sm text-content">
                    {friend.display_name || friend.username}
                  </span>
                  <Check size={16} className="text-primary" />
                </button>
              ))}
            </div>
          )}
        </ModalContent>
      </Modal>

      <ToastProvider>
        <Toast message={toastMsg} open={toastOpen} onOpenChange={setToastOpen} />
        <ToastViewport />
      </ToastProvider>
    </aside>
  );
}
