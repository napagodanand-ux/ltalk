import { useEffect, useRef } from 'react';
import type { Message } from '../../../../src/shared/types';

import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

export function MessageList({
  messages,
  conversationId,
  onReply
}: {
  messages: Message[];
  conversationId: string;
  onReply: (id: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const typing = useMessageStore((s) => s.typing[conversationId]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typing]);

  const replyById = new Map(messages.map((m) => [m.id, m]));

  return (
    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          isOwn={m.sender_id === user?.id}
          onReply={onReply}
          replyTo={m.reply_to_id ? replyById.get(m.reply_to_id) : null}
        />
      ))}
      {typing && <TypingIndicator />}
      <div ref={endRef} />
    </div>
  );
}
