import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Message } from '../../../src/shared/types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Sidebar/last-message preview text for a conversation. Exported (and tested)
// so both the UI and the tests agree on the exact wording.
export function messagePreview(message: Message | null): string {
  if (!message) return 'No messages yet';
  if (message.type === 'text') return message.content ?? 'Message deleted';
  if (message.type === 'image') return 'Image';
  return 'Attachment';
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isSameDay) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`;
}

export function relativeTime(iso: string): string {
  const date = new Date(iso).getTime();
  const diff = Date.now() - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delay = 300): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: never[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// A profile is treated as offline when it is explicitly offline OR its last
// heartbeat/seen timestamp is stale. This is what makes a force-killed app
// (where no unload event fires) eventually show as offline instead of "away".
const OFFLINE_AFTER_MS = 90_000;

export type EffectiveStatus = 'online' | 'away' | 'offline';

export function effectiveStatus(
  status: EffectiveStatus | undefined | null,
  lastSeen: string | undefined | null
): EffectiveStatus {
  if (status === 'offline') return 'offline';
  const seen = lastSeen ? new Date(lastSeen).getTime() : 0;
  if (!seen || Date.now() - seen > OFFLINE_AFTER_MS) return 'offline';
  return status === 'away' ? 'away' : 'online';
}

// Semantic version comparison. Returns <0 if a<b, 0 if equal, >0 if a>b.
// Handles `1.0.9` vs `1.0.10` correctly (numeric segments, not string order).
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
