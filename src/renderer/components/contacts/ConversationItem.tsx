import type { ConversationView } from '../../stores/conversationStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { useUiStore } from '../../stores/uiStore';
import { Avatar, ContextMenu, ContextMenuItem } from '../ui';
import { cn, formatTimestamp, messagePreview, effectiveStatus } from '../../lib/helpers';
import { useIsMobile } from '../../lib/hooks';
import { deleteConversation } from '../../lib/api/conversations';

function trailingVoiceCount(conversation: ConversationView): number {
  const messages = useMessageStore.getState().byConversation[conversation.id];
  if (!messages || messages.length === 0) return 1;
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'voice') count++;
    else break;
  }
  return count || 1;
}

function previewFor(conversation: ConversationView): string {
  return messagePreview(conversation.lastMessage, trailingVoiceCount(conversation));
}

export function ConversationItem({
  conversation,
  onSelect
}: {
  conversation: ConversationView;
  onSelect?: () => void;
}) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const activeId = useConversationStore((s) => s.activeId);
  const setUnread = useConversationStore((s) => s.setUnread);
  const remove = useConversationStore((s) => s.remove);
  const isMuted = useUiStore((s) => s.isMuted(conversation.id));
  const toggleMute = useUiStore((s) => s.toggleMute);

  const isGroup = conversation.is_group;
  const other = isGroup
    ? null
    : conversation.participants.find((p) => p.id !== currentUserId);

  const avatarSrc = isGroup ? conversation.group_avatar_url : other?.avatar_url ?? null;
  const title = isGroup
    ? conversation.name || 'Group'
    : other?.display_name || other?.username || 'Unknown';

  const isActive = activeId === conversation.id;
  const isMobile = useIsMobile();

  const subtitle = isGroup
    ? `${conversation.participants.length} members`
    : previewFor(conversation);

  return (
    <ContextMenu
      trigger={
        <button
          onClick={onSelect}
          className={cn(
            'flex w-full items-center gap-3 px-3 py-2 text-left',
            isActive ? 'bg-surface-hover' : 'hover:bg-surface-hover'
          )}
        >
          <Avatar
            src={avatarSrc}
            name={title}
            size={40}
            status={other ? effectiveStatus(other.status, other.last_seen) : undefined}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-content">{title}</span>
              {conversation.lastMessage && (
                <span className="shrink-0 text-xs text-content-muted">
                  {formatTimestamp(conversation.lastMessage.created_at)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-content-secondary">{subtitle}</span>
              {conversation.unreadCount > 0 && (
                <span
                  className={cn(
                    'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium text-white',
                    isMobile ? 'wa-badge' : 'bg-primary'
                  )}
                >
                  {conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      }
    >
      <ContextMenuItem
        onSelect={() => {
          setUnread(conversation.id, 0);
          void useMessageStore.getState().markRead(conversation.id);
        }}
      >
        Mark as read
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => toggleMute(conversation.id)}>
        {isMuted ? 'Unmute' : 'Mute'}
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => {
          if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
          // Remove from the local list first so a subsequent "start chat" opens
          // a brand-new (uncapped) conversation instead of reusing this one.
          // The server delete is best-effort; if it fails the local removal
          // still stands and the conversation can be restarted fresh.
          remove(conversation.id);
          void deleteConversation(conversation.id).catch(() => undefined);
        }}
      >
        Delete conversation
      </ContextMenuItem>
    </ContextMenu>
  );
}
