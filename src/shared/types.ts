export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string;
  public_key: string | null;
  key_backup_cipher: string | null;
  key_backup_salt: string | null;
  status: 'online' | 'offline' | 'away';
  last_seen: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  group_avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_message_id: string | null;
}

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'audio';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: MessageType;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  duration: number | null;
  mime_type: string | null;
  encrypted: boolean;
  is_read: boolean;
  read_at: string | null;
  reply_to_id: string | null;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reaction {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export type CallType = 'voice' | 'video';

export interface Call {
  id: string;
  conversation_id: string;
  initiator_id: string;
  type: CallType;
  status: 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
}

export interface CallParticipant {
  call_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface ConversationSummary {
  conversation: Conversation;
  lastMessage: Message | null;
  participants: Profile[];
  unreadCount: number;
}

export interface SessionUser {
  id: string;
  email: string | null;
  username: string;
  displayName: string | null;
}

export type ThemeName = 'light' | 'dark';

export const FRIEND_ONLY_CONVERSATIONS = true;
