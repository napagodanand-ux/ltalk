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
    async (_event: IpcMainInvokeEvent, conversationId: string, _upToMessageId: string) => {
      const {
        data: { user }
      } = await authSupabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // mark_conversation_read is SECURITY DEFINER: it lets a participant set
      // is_read on messages sent by the other person (the normal UPDATE policy
      // only allows editing one's own rows). This is what makes read receipts
      // persist across refreshes.
      const { error } = await authSupabase.rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
        p_reader: user.id
      });
      if (error) {
        log.error('markRead failed', error.message);
        throw new Error(error.message);
      }
      return true;
    }
  );
}
