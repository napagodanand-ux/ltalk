import { useMemo, useState } from 'react';
import { ContextMenu, ContextMenuItem } from '../ui';
import {
  Check,
  CheckCheck,
  Reply,
  Copy,
  Trash2,
  Forward,
  FileText,
  Pencil,
  Smile
} from 'lucide-react';
import type { Message } from '../../../../src/shared/types';

import { formatFileSize, formatTimestamp, cn } from '../../lib/helpers';
import { useMessageStore } from '../../stores/messageStore';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useConversationStore } from '../../stores/conversationStore';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

function removeLocal(message: Message): void {
  useMessageStore.setState((state) => ({
    byConversation: {
      ...state.byConversation,
      [message.conversation_id]: (
        state.byConversation[message.conversation_id] ?? []
      ).filter((m) => m.id !== message.id)
    }
  }));
}

export function MessageBubble({
  message,
  isOwn,
  onReply,
  replyTo
}: {
  message: Message;
  isOwn: boolean;
  onReply: (id: string) => void;
  replyTo?: Message | null;
}) {
  const user = useAuthStore((s) => s.user);
  const activeId = useConversationStore((s) => s.activeId);
  const conversation = useConversationStore((s) => (activeId ? s.getById(activeId) : undefined));
  const reactions = useMessageStore((s) => s.reactionsByMessage[message.id]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);

  const deleted = message.type === 'text' && message.content === null;
  const isAttachment = message.type !== 'text' && Boolean(message.file_url);

  const replySender = replyTo
    ? conversation?.participants.find((p) => p.id === replyTo.sender_id)
    : undefined;
  const replyName =
    replyTo?.sender_id === user?.id
      ? 'You'
      : replySender?.display_name || replySender?.username || 'Someone';

  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions ?? []) {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      map.set(r.emoji, { count: cur.count + 1, mine: cur.mine || r.user_id === user?.id });
    }
    return [...map.entries()].map(([emoji, v]) => ({ emoji, ...v }));
  }, [reactions, user?.id]);

  const canEdit = isOwn && message.type === 'text' && message.content !== null;
  const canReact = !deleted;

  const saveEdit = () => {
    const text = draft.trim();
    if (text && activeId) {
      void useMessageStore.getState().editMessage(message.id, activeId, text);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="flex w-[70%] max-w-[70%] flex-col gap-1">
          <textarea
            className="lt-input w-full resize-none rounded-md bg-surface px-3 py-2 text-sm"
            rows={2}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEdit();
              }
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <div className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}>
            <button
              className="rounded bg-surface-hover px-2 py-1 text-xs text-content hover:bg-edge"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary-hover"
              onClick={saveEdit}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bubble = (
    <div
      className={cn(
        'max-w-[70%] rounded-lg px-3 py-2 text-sm',
        isOwn ? 'bg-primary text-white' : 'bg-surface-hover text-content'
      )}
    >
      {replyTo && (
        <div className="mb-1 border-l-2 border-white/40 pl-2 text-xs opacity-90">
          <div className="font-medium">{replyName}</div>
          <div className="truncate opacity-80">
            {replyTo.content ?? replyTo.file_name ?? 'Attachment'}
          </div>
        </div>
      )}
      {deleted ? (
        <span className="italic opacity-70">This message was deleted</span>
      ) : isAttachment ? (
        <div className="space-y-1">
          {message.type === 'image' && message.file_url && (
            <a href={message.file_url} target="_blank" rel="noreferrer">
              <img
                src={message.file_url}
                alt={message.file_name ?? ''}
                className="max-h-60 rounded-md object-cover"
              />
            </a>
          )}
          {message.type === 'video' && message.file_url && (
            <video src={message.file_url} controls className="max-h-60 rounded-md" />
          )}
          {message.file_url && (
            <div className="flex items-center gap-2">
              <FileText size={16} className="shrink-0" />
              <a
                href={message.file_url}
                download
                className="truncate underline underline-offset-2"
              >
                {message.file_name}
              </a>
              {message.file_size != null && (
                <span className="shrink-0 opacity-70 text-xs">
                  {formatFileSize(message.file_size)}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <span className="whitespace-pre-wrap break-words">{message.content}</span>
      )}

      <div className="mt-1 flex items-center justify-end gap-1">
        <span className="text-[11px] opacity-70">
          {formatTimestamp(message.created_at)}
          {message.edited ? ' (edited)' : ''}
        </span>
        {isOwn &&
          (message.is_read ? (
            <CheckCheck size={14} className="text-blue-400" />
          ) : (
            <Check size={14} className="opacity-70" />
          ))}
      </div>
    </div>
  );

  return (
    <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}>
      <div className="flex max-w-[70%] flex-col">
        <ContextMenu trigger={bubble}>
          {canEdit && (
            <ContextMenuItem onSelect={() => setEditing(true)}>
              <Pencil size={14} /> Edit
            </ContextMenuItem>
          )}
          {canReact && (
            <ContextMenuItem onSelect={() => setPickerOpen((v) => !v)}>
              <Smile size={14} /> React
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => navigator.clipboard.writeText(message.content ?? '')}>
            <Copy size={14} /> Copy
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onReply(message.id)}>
            <Reply size={14} /> Reply
          </ContextMenuItem>
          {canReact && (
            <ContextMenuItem
              onSelect={() => {
                if (message.content) {
                  useUiStore.getState().setForwardContent(message.content);
                  useUiStore.getState().setNewConversationOpen(true);
                }
              }}
            >
              <Forward size={14} /> Forward
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => void useMessageStore.getState().hideForMe(message.id)}>
            <Trash2 size={14} /> Delete for me
          </ContextMenuItem>
          {isOwn && (
            <ContextMenuItem
              onSelect={() => {
                void window.electron.messages.deleteForEveryone(
                  message.conversation_id,
                  message.id
                );
                removeLocal(message);
              }}
            >
              <Trash2 size={14} /> Delete for everyone
            </ContextMenuItem>
          )}
        </ContextMenu>

        {grouped.length > 0 && (
          <div className={cn('mt-1 flex flex-wrap gap-1', isOwn ? 'justify-end' : 'justify-start')}>
            {grouped.map((g) => (
              <button
                key={g.emoji}
                onClick={() => void useMessageStore.getState().toggleReaction(message.id, g.emoji)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs transition-colors',
                  g.mine ? 'border-primary bg-primary/10' : 'border-edge bg-surface hover:bg-surface-hover'
                )}
              >
                {g.emoji} {g.count}
              </button>
            ))}
          </div>
        )}

        {pickerOpen && canReact && (
          <div
            className={cn(
              'mt-1 flex w-fit gap-1 rounded-md border border-edge bg-surface p-1 shadow-panel',
              isOwn ? 'self-end' : 'self-start'
            )}
          >
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  void useMessageStore.getState().toggleReaction(message.id, e);
                  setPickerOpen(false);
                }}
                className="rounded px-1 text-lg leading-none hover:scale-110 hover:bg-surface-hover"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
