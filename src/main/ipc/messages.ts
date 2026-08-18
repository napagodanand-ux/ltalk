import { ipcMain, IpcMainInvokeEvent } from 'electron';

import { authSupabase } from './storage';
import { log } from '../logger';

const MESSAGES_CHANNEL = 'messages';

export function registerMessageHandlers(): void {
  ipcMain.handle(
    `${MESSAGES_CHANNEL}:deleteForEveryone`,
    async (_event: IpcMainInvokeEvent, conversationId: string, messageId: string) => {
      const { error } = await authSupabase
        .from('messages')
        .update({ content: null, type: 'text', file_url: null })
        .eq('id', messageId)
        .eq('conversation_id', conversationId);
      if (error) {
        log.error('deleteForEveryone failed', error.message);
        throw new Error(error.message);
      }
      return true;
    }
  );

  ipcMain.handle(
    `${MESSAGES_CHANNEL}:markRead`,
    async (_event: IpcMainInvokeEvent, conversationId: string, upToMessageId: string) => {
      const {
        data: { user }
      } = await authSupabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: msgError } = await authSupabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id);
      if (msgError) {
        log.error('markRead failed', msgError.message);
        throw new Error(msgError.message);
      }

      const { error: partError } = await authSupabase
        .from('conversation_participants')
        .update({ last_read_message_id: upToMessageId })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
      if (partError) {
        log.error('markRead participants failed', partError.message);
        throw new Error(partError.message);
      }
      return true;
    }
  );
}
