import { useState, useCallback, useEffect } from 'react';
import type { Message } from '../../../../src/shared/types';
import { NON_FRIEND_MESSAGE_LIMIT } from '../../../../src/shared/constants';

import { useConversationStore } from '../../stores/conversationStore';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { useFriendStore } from '../../stores/friendStore';
import { getNonFriendMessageTotal } from '../../lib/api/conversations';

import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput, sendFile } from './MessageInput';
import { EmptyState } from './EmptyState';
import { Spinner } from '../ui';
import { X, UserPlus } from 'lucide-react';

const EMPTY_MESSAGES: Message[] = [];

export default function ChatArea() {
  const activeId = useConversationStore((s) => s.activeId);
  const getById = useConversationStore((s) => s.getById);
  const messages = useMessageStore((s) =>
    activeId ? s.byConversation[activeId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES
  );

  const user = useAuthStore((s) => s.user);
  const friends = useFriendStore((s) => s.friends);
  const sendRequest = useFriendStore((s) => s.sendRequest);

  // Non-friend 1:1 conversations are capped at NON_FRIEND_MESSAGE_LIMIT messages
  // (enforced server-side). Once reached, block further sending until they become
  // friends.
  const conversation = getById(activeId ?? '');
  const other =
    conversation && !conversation.is_group
      ? conversation.participants.find((p) => p.id !== user?.id)
      : undefined;
  const otherIsFriend = other ? friends.some((f) => f.id === other.id) : false;
  const otherId = other?.id;

  // The 3-message non-friend cap is enforced per person-pair (server-side, in a
  // persistent tally), not per conversation. We mirror that tally here so the
  // limit holds even after a conversation is deleted and recreated. Re-fetch
  // whenever the open conversation or its message count changes (a send/receive
  // updates the server tally, which we then reflect).
  const [pairTotal, setPairTotal] = useState(0);
  useEffect(() => {
    if (otherId && !otherIsFriend && activeId) {
      let cancelled = false;
      void getNonFriendMessageTotal(otherId).then((t) => {
        if (!cancelled) setPairTotal(t);
      });
      return () => {
        cancelled = true;
      };
    }
    setPairTotal(0);
  }, [activeId, otherId, otherIsFriend, messages.length]);

  const atLimit =
    Boolean(other && !otherIsFriend) && pairTotal >= NON_FRIEND_MESSAGE_LIMIT;

  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      if (!activeId) return;
      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;
      setUploading(true);
      try {
        for (const file of files) {
          await sendFile(activeId, file);
        }
      } finally {
        setUploading(false);
      }
    },
    [activeId]
  );

  if (!activeId) return <EmptyState />;

  const replyMessage = replyToId
    ? messages.find((m) => m.id === replyToId)
    : undefined;

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {conversation && <ChatHeader conversation={conversation} />}

      <MessageList
        messages={messages}
        conversationId={activeId}
        onReply={setReplyToId}
      />

      {replyToId && replyMessage && (
        <div className="flex items-center gap-2 border-t border-edge bg-bg-secondary px-4 py-1.5 text-xs">
          <span className="text-content-muted">Replying to</span>
          <span className="flex-1 truncate text-content-secondary">
            {replyMessage.content ?? replyMessage.file_name ?? 'attachment'}
          </span>
          <button
            aria-label="Clear reply"
            className="text-content-muted hover:text-content"
            onClick={() => setReplyToId(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {atLimit && other && (
        <div className="flex items-center gap-3 border-t border-edge bg-bg-secondary px-4 py-2 text-sm">
          <span className="flex-1 text-content-secondary">
            You've reached the {NON_FRIEND_MESSAGE_LIMIT}-message limit with{' '}
            {other.display_name || other.username}. Send a friend request to keep chatting.
          </span>
          <button
            type="button"
            onClick={() => void sendRequest(other.id)}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
          >
            <UserPlus size={14} /> Add friend
          </button>
        </div>
      )}

      <MessageInput
        conversationId={activeId}
        replyToId={replyToId}
        onClearReply={() => setReplyToId(null)}
        disabled={atLimit}
      />

      {uploading && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-surface px-3 py-1.5 shadow-panel">
          <Spinner size={16} />
        </div>
      )}
    </div>
  );
}
