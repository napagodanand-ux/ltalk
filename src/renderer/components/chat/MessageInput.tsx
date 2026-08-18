import { useState, useRef } from 'react';
import type { Message, MessageType } from '../../../../src/shared/types';

import { IconButton, Textarea, Spinner } from '../ui';
import { EmojiPicker } from '../ui/EmojiPicker';
import { Send, Paperclip } from 'lucide-react';

import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { uploadMedia } from '../../lib/api/messages';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/helpers';

function deriveType(mime: string): MessageType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'voice';
  return 'file';
}

export async function sendFile(
  conversationId: string,
  file: File,
  onProgress?: (ratio: number) => void
): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;

  const uploaded = await uploadMedia(conversationId, file, onProgress);
  const type = deriveType(uploaded.mime);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: null,
      type,
      encrypted: false,
      file_url: uploaded.url,
      file_name: uploaded.name,
      file_size: uploaded.size,
      mime_type: uploaded.mime
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  await useMessageStore.getState().receive(data as Message, 'INSERT');
}

export function MessageInput({
  conversationId,
  replyToId,
  onClearReply
}: {
  conversationId: string;
  replyToId?: string | null;
  onClearReply?: () => void;
}) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const pushToast = useToastStore((s) => s.push);

  const insertEmoji = (emoji: string) => {
    const el = textRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      if (el) {
        const pos = start + emoji.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const reply = replyToId ?? null;
    setText('');
    onClearReply?.();
    try {
      await useMessageStore.getState().send(conversationId, trimmed, reply);
    } catch {
      pushToast({ body: 'Failed to send message', variant: 'error' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (e.target.value.trim()) {
      useMessageStore.getState().notifyTyping(conversationId);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      await sendFile(conversationId, file, setProgress);
    } catch {
      pushToast({ body: 'Failed to send attachment', variant: 'error' });
    } finally {
      setUploading(false);
      setProgress(0);
      e.target.value = '';
    }
  };

  return (
    <div className="border-t border-edge bg-bg-secondary">
      <div className="flex items-end gap-2 px-3 py-2">
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
        <IconButton label="Attach file" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Spinner size={16} /> : <Paperclip size={18} />}
        </IconButton>

        <Textarea
          ref={textRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Type a message"
          className={cn(
            'min-h-[36px] max-h-32 flex-1 rounded-md py-2 text-sm leading-5',
            'bg-surface px-3'
          )}
        />

        <EmojiPicker onSelect={insertEmoji} label="Insert emoji" align="right" />

        <IconButton
          label="Send"
          onClick={() => void handleSend()}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          <Send size={18} />
        </IconButton>
      </div>
      {uploading && (
        <div className="h-1 w-full overflow-hidden bg-surface">
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${Math.max(8, Math.round(progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}
