import { Avatar, IconButton } from '../ui';
import { Info, Search } from 'lucide-react';

import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import type { ConversationView } from '../../stores/conversationStore';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ChatHeader({ conversation }: { conversation: ConversationView }) {
  const user = useAuthStore((s) => s.user);
  const setRightPanel = useUiStore((s) => s.setRightPanel);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);

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
    : (other?.status ? capitalize(other.status) : 'Offline');

  return (
    <div className="flex items-center gap-3 border-b border-edge bg-bg-secondary px-4 py-2.5">
      <Avatar src={avatarSrc} name={title} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-content">{title}</div>
        <div className="truncate text-xs text-content-muted">{subtitle}</div>
      </div>
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
