import { Avatar, IconButton } from '../ui';
import { Info, Search, ArrowLeft } from 'lucide-react';

import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useConversationStore } from '../../stores/conversationStore';
import { effectiveStatus } from '../../lib/helpers';
import { useIsMobile } from '../../lib/hooks';
import type { ConversationView } from '../../stores/conversationStore';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ChatHeader({ conversation }: { conversation: ConversationView }) {
  const user = useAuthStore((s) => s.user);
  const setRightPanel = useUiStore((s) => s.setRightPanel);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const select = useConversationStore((s) => s.select);
  const isMobile = useIsMobile();

  const isGroup = conversation.is_group;
  const other = isGroup
    ? undefined
    : conversation.participants.find((p) => p.id !== user?.id);

  const title = isGroup
    ? conversation.name ?? 'Group'
    : (other?.display_name ?? other?.username ?? 'Unknown');
  const avatarSrc = isGroup ? conversation.group_avatar_url : (other?.avatar_url ?? null);
  const subtitle = isGroup
    ? `${conversation.participants.length} members`
    : other
      ? capitalize(effectiveStatus(other.status, other.last_seen))
      : 'Offline';

  return (
    <div className="flex items-center gap-3 border-b border-edge bg-bg-secondary px-4 py-2.5">
      {isMobile && (
        <IconButton label="Back" className="-ml-1" onClick={() => select(null)}>
          <ArrowLeft size={20} />
        </IconButton>
      )}
      <button
        type="button"
        className="flex min-w-0 items-center gap-3"
        onClick={() => setRightPanel(!rightPanelOpen)}
        title="View details"
      >
        <Avatar src={avatarSrc} name={title} size={36} />
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-content">{title}</div>
          <div className="truncate text-xs text-content-muted">{subtitle}</div>
        </div>
      </button>
      <IconButton label="Search" className="ml-auto">
        <Search size={18} />
      </IconButton>
      <IconButton
        label="Conversation info"
        onClick={() => setRightPanel(!rightPanelOpen)}
      >
        <Info size={18} />
      </IconButton>
    </div>
  );
}
