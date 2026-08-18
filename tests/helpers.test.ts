import { describe, it, expect } from 'vitest';
import { formatFileSize, messagePreview } from '../src/renderer/lib/helpers';
import type { Message } from '../src/shared/types';

function msg(partial: Partial<Message>): Message {
  return {
    id: '1',
    conversation_id: 'c',
    sender_id: 's',
    content: '',
    type: 'text',
    file_url: null,
    file_name: null,
    file_size: null,
    mime_type: null,
    encrypted: false,
    is_read: false,
    read_at: null,
    reply_to_id: null,
    edited: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial
  } as Message;
}

describe('formatFileSize', () => {
  it('formats bytes and KB/MB', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('messagePreview', () => {
  it('handles no message', () => {
    expect(messagePreview(null)).toBe('No messages yet');
  });

  it('shows text content', () => {
    expect(messagePreview(msg({ content: 'hi there' }))).toBe('hi there');
  });

  it('shows placeholder for deleted text', () => {
    expect(messagePreview(msg({ content: null }))).toBe('Message deleted');
  });

  it('shows labels for media', () => {
    expect(messagePreview(msg({ type: 'image', content: null }))).toBe('Image');
    expect(messagePreview(msg({ type: 'file', content: null }))).toBe('Attachment');
  });
});
