import { useState, useRef, useEffect } from 'react';
import type { Message, MessageType } from '../../../../src/shared/types';

import { IconButton, Textarea, Spinner } from '../ui';
import { EmojiPicker } from '../ui/EmojiPicker';
import { Send, Paperclip, Mic, Square, X } from 'lucide-react';

import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { uploadMedia } from '../../lib/api/messages';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/helpers';
import { useIsMobile } from '../../lib/hooks';

function deriveType(mime: string): MessageType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'voice';
  return 'file';
}

// Reads the playback duration (seconds) of an audio blob via a temporary
// <audio> element so we can persist it for voice-message previews.
function getAudioDuration(blob: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';
    const cleanup = () => URL.revokeObjectURL(url);
    audio.onloadedmetadata = () => {
      cleanup();
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : undefined);
    };
    audio.onerror = () => {
      cleanup();
      resolve(undefined);
    };
    audio.src = url;
  });
}

export async function sendFile(
  conversationId: string,
  file: File,
  onProgress?: (ratio: number) => void,
  duration?: number | null
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
      duration: type === 'voice' ? duration ?? null : null,
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
  onClearReply,
  disabled
}: {
  conversationId: string;
  replyToId?: string | null;
  onClearReply?: () => void;
  disabled?: boolean;
}) {
  const isMobile = useIsMobile();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const pushToast = useToastStore((s) => s.push);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const insertEmoji = (emoji: string) => {
    if (disabled) return;
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

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopTracks();
        setRecording(false);
        setElapsed(0);
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm'
        });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: blob.type
        });
        try {
          const duration = await getAudioDuration(blob);
          await sendFile(conversationId, file, undefined, duration);
        } catch {
          pushToast({ body: 'Failed to send voice message', variant: 'error' });
        }
      };
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      pushToast({ body: 'Microphone unavailable or permission denied', variant: 'error' });
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    stopRecording();
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
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
    if (disabled) return;
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
      {recording ? (
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-sm tabular-nums text-content">
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
            {String(elapsed % 60).padStart(2, '0')}
          </span>
          <span className="text-xs text-content-muted">Recording…</span>
          <div className="flex-1" />
          <IconButton label="Cancel recording" onClick={cancelRecording}>
            <X size={18} />
          </IconButton>
          <IconButton
            label="Send voice message"
            onClick={stopRecording}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            <Square size={18} />
          </IconButton>
        </div>
      ) : (
        <div className="flex items-end gap-2 px-3 py-2">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
          <IconButton label="Attach file" onClick={() => fileRef.current?.click()} disabled={disabled || uploading}>
            {uploading ? <Spinner size={16} /> : <Paperclip size={18} />}
          </IconButton>

          <Textarea
            ref={textRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={disabled ? 'Message limit reached — add as friend to continue' : 'Type a message'}
            disabled={disabled}
            className={cn(
              'min-h-[36px] max-h-32 flex-1 rounded-md py-2 text-sm leading-5',
              'bg-surface px-3',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          />

          <EmojiPicker onSelect={insertEmoji} label="Insert emoji" align="right" disabled={disabled} />

          {!isMobile && (
            <IconButton label="Record voice message" onClick={() => void startRecording()} disabled={disabled}>
              <Mic size={18} />
            </IconButton>
          )}

          {!isMobile && (
            <IconButton
              label="Send"
              onClick={() => void handleSend()}
              disabled={disabled || !text.trim()}
              className="bg-primary text-white hover:bg-primary-hover"
            >
              <Send size={18} />
            </IconButton>
          )}

          {isMobile &&
            (text.trim() ? (
              <IconButton
                label="Send"
                onClick={() => void handleSend()}
                disabled={disabled}
                className="bg-primary text-white hover:bg-primary-hover"
              >
                <Send size={18} />
              </IconButton>
            ) : (
              <IconButton label="Record voice message" onClick={() => void startRecording()} disabled={disabled}>
                <Mic size={18} />
              </IconButton>
            ))}
        </div>
      )}
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
