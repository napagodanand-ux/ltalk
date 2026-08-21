import { Phone, PhoneOff } from 'lucide-react';
import { useCallStore } from '../../stores/callStore';
import { useConversationStore } from '../../stores/conversationStore';
import { callManager } from '../../lib/call';
import { Avatar, IconButton } from '../ui';

export function IncomingCallDialog() {
  const incoming = useCallStore((s) => s.incoming);
  const conv = useConversationStore((s) =>
    incoming ? s.conversations.find((c) => c.id === incoming.conversationId) : undefined
  );

  if (!incoming || !conv) return null;

  const isGroup = conv.is_group;
  const initiator = conv.participants.find((p) => p.id === incoming.initiatorId);
  const name = isGroup
    ? (conv.name ?? 'Group')
    : (initiator?.display_name ?? initiator?.username ?? 'Unknown');
  const avatarSrc = isGroup ? conv.group_avatar_url : (initiator?.avatar_url ?? null);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-[300px] rounded-2xl bg-bg-secondary p-6 text-center shadow-xl">
        <Avatar src={avatarSrc} name={name} size={64} />
        <div className="mt-3 text-lg font-semibold text-content">{name}</div>
        <div className="text-sm text-content-muted">
          {incoming.type === 'video' ? 'Incoming video call' : 'Incoming voice call'}
        </div>
        <div className="mt-5 flex items-center justify-center gap-4">
          <IconButton
            label="Decline"
            onClick={() => callManager.declineCall()}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            <PhoneOff size={22} />
          </IconButton>
          <IconButton
            label="Accept"
            onClick={() => void callManager.acceptCall()}
            className="bg-green-500 text-white hover:bg-green-600"
          >
            <Phone size={22} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
