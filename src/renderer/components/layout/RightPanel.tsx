import { useState } from 'react';

import { X, UserPlus, UserX, Eraser, Check, Pencil, Trash2, LogOut } from 'lucide-react';

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
import {
  addParticipants,
  clearMessages,
  renameGroup,
  removeMember,
  deleteGroup
} from '../../lib/api/conversations';
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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  if (!rightPanelOpen || !activeId || !conversation) return null;

  const isGroup = conversation.is_group;
  const isAdmin = isGroup && conversation.created_by === currentUserId;
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

  const startRename = () => {
    setNameDraft(conversation?.name ?? '');
    setEditingName(true);
  };

  const commitRename = async () => {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (!trimmed || trimmed === conversation?.name) return;
    try {
      await renameGroup(activeId, trimmed);
      await useConversationStore.getState().load();
      showToast('Group renamed');
    } catch {
      showToast('Failed to rename group');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeMember(activeId, userId);
      await useConversationStore.getState().load();
      showToast('Member removed');
    } catch {
      showToast('Failed to remove member');
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Leave this group?')) return;
    try {
      await removeMember(activeId, currentUserId ?? '');
      await useConversationStore.getState().load();
      setRightPanel(false);
      showToast('Left group');
    } catch {
      showToast('Failed to leave group');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Delete this group for everyone? This cannot be undone.')) return;
    try {
      await deleteGroup(activeId);
      await useConversationStore.getState().load();
      setRightPanel(false);
      showToast('Group deleted');
    } catch {
      showToast('Failed to delete group');
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
          <div className="flex items-center justify-center gap-1.5 text-base font-semibold text-content">
            {isGroup ? (
              editingName ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="w-40 rounded border border-edge bg-bg-tertiary px-2 py-0.5 text-center text-base text-content outline-none"
                />
              ) : (
                <>
                  <span>{conversation.name || 'Group'}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={startRename}
                      className="text-content-muted hover:text-content"
                      aria-label="Rename group"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </>
              )
            ) : (
              (other?.display_name || other?.username || 'Unknown')
            )}
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
            {isAdmin && (
              <Button variant="ghost" className="w-full justify-start" onClick={() => setAddOpen(true)}>
                <UserPlus size={16} /> Add members
              </Button>
            )}
            {conversation.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1">
                <Avatar src={p.avatar_url} name={p.display_name || p.username} size={28} />
                <span className="flex-1 truncate text-sm text-content">
                  {p.display_name || p.username}
                  {p.id === currentUserId && (
                    <span className="ml-1 text-xs text-content-muted">(you)</span>
                  )}
                  {isGroup && conversation.created_by === p.id && (
                    <span className="ml-1 text-xs text-accent">admin</span>
                  )}
                </span>
                {isAdmin && p.id !== currentUserId && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveMember(p.id)}
                    className="text-content-muted hover:text-red-400"
                    aria-label="Remove member"
                  >
                    <UserX size={15} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              {isAdmin ? (
                <Button variant="ghost" className="w-full justify-start text-red-400" onClick={handleDeleteGroup}>
                  <Trash2 size={16} /> Delete group
                </Button>
              ) : (
                <Button variant="ghost" className="w-full justify-start text-red-400" onClick={handleLeave}>
                  <LogOut size={16} /> Leave group
                </Button>
              )}
            </div>
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
