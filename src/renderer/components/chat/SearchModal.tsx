import { useMemo, useState } from 'react';

import { useUiStore } from '../../stores/uiStore';
import { useMessageStore } from '../../stores/messageStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useAuthStore } from '../../stores/authStore';
import { Modal, ModalContent, Avatar, Input } from '../ui';
import { formatTimestamp, cn } from '../../lib/helpers';

interface Hit {
  conversationId: string;
  messageId: string;
  content: string;
  senderId: string;
  senderName: string;
  title: string;
  time: string;
  avatar?: string | null;
}

function snippet(text: string, q: string): string {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text.slice(0, 90);
  const start = Math.max(0, idx - 30);
  return (start > 0 ? '…' : '') + text.slice(start, start + 90);
}

export function SearchModal() {
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const byConversation = useMessageStore((s) => s.byConversation);
  const conversations = useConversationStore((s) => s.conversations);
  const select = useConversationStore((s) => s.select);
  const meId = useAuthStore((s) => s.user?.id);
  const [query, setQuery] = useState('');

  const results = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const convMap = new Map(conversations.map((c) => [c.id, c]));
    const hits: Hit[] = [];
    for (const [convId, messages] of Object.entries(byConversation)) {
      const conv = convMap.get(convId);
      if (!conv) continue;
      const title = conv.is_group
        ? conv.name || 'Group'
        : conv.participants.find((p) => p.id !== meId)?.display_name ||
          conv.participants.find((p) => p.id !== meId)?.username ||
          'Chat';
      for (const m of messages) {
        if (!m.content || !m.content.toLowerCase().includes(q)) continue;
        const sender =
          m.sender_id === meId
            ? 'You'
            : conv.participants.find((p) => p.id === m.sender_id)?.display_name ||
              conv.participants.find((p) => p.id === m.sender_id)?.username ||
              'Someone';
        hits.push({
          conversationId: convId,
          messageId: m.id,
          content: m.content,
          senderId: m.sender_id,
          senderName: sender,
          title,
          time: m.created_at,
          avatar: conv.is_group
            ? conv.group_avatar_url
            : conv.participants.find((p) => p.id !== meId)?.avatar_url ?? null
        });
        if (hits.length >= 100) break;
      }
      if (hits.length >= 100) break;
    }
    return hits;
  }, [query, byConversation, conversations, meId]);

  const openConversation = (convId: string) => {
    select(convId);
    setOpen(false);
    setQuery('');
  };

  return (
    <Modal open={open} onOpenChange={(o) => setOpen(o)}>
      <ModalContent title="Search messages">
        <Input
          autoFocus
          placeholder="Search your messages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-3 max-h-[360px] overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <div className="py-6 text-center text-sm text-content-muted">No matches</div>
          )}
          {results.map((hit) => (
            <button
              key={hit.messageId}
              type="button"
              onClick={() => openConversation(hit.conversationId)}
              className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-hover"
            >
              <Avatar src={hit.avatar} name={hit.title} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-content">{hit.title}</span>
                  <span className="shrink-0 text-xs text-content-muted">
                    {formatTimestamp(hit.time)}
                  </span>
                </div>
                <div className="truncate text-xs text-content-secondary">
                  <span className={cn('font-medium', hit.senderId === meId ? 'text-primary' : '')}>
                    {hit.senderName}:{' '}
                  </span>
                  {snippet(hit.content, query)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ModalContent>
    </Modal>
  );
}
