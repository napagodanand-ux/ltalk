import { useState, useCallback } from 'react';
import type { Message } from '../../../../src/shared/types';

import { useConversationStore } from '../../stores/conversationStore';
import { useMessageStore } from '../../stores/messageStore';

import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput, sendFile } from './MessageInput';
import { EmptyState } from './EmptyState';
import { Spinner } from '../ui';
import { X } from 'lucide-react';

const EMPTY_MESSAGES: Message[] = [];

export default function ChatArea() {
  const activeId = useConversationStore((s) => s.activeId);
  const getById = useConversationStore((s) => s.getById);
  const messages = useMessageStore((s) =>
    activeId ? s.byConversation[activeId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES
  );

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

  const conversation = getById(activeId);
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

      <MessageInput
        conversationId={activeId}
        replyToId={replyToId}
        onClearReply={() => setReplyToId(null)}
      />

      {uploading && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-surface px-3 py-1.5 shadow-panel">
          <Spinner size={16} />
        </div>
      )}
    </div>
  );
}
