import { ipcMain, IpcMainInvokeEvent } from 'electron';

import { authSupabase } from './storage';
import { log } from '../logger';

const FRIENDS_CHANNEL = 'friendships';

export function registerFriendshipHandlers(): void {
  ipcMain.handle(
    `${FRIENDS_CHANNEL}:canMessage`,
    async (_event: IpcMainInvokeEvent, targetUserId: string): Promise<boolean> => {
      const {
        data: { user }
      } = await authSupabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await authSupabase
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`)
        .eq('status', 'accepted')
        .maybeSingle();

      if (error) {
        log.error('canMessage check failed', error.message);
        return false;
      }
      return Boolean(data);
    }
  );

  ipcMain.handle(
    `${FRIENDS_CHANNEL}:block`,
    async (_event: IpcMainInvokeEvent, targetUserId: string) => {
      const {
        data: { user }
      } = await authSupabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await authSupabase
        .from('friendships')
        .upsert(
          { user_id: user.id, friend_id: targetUserId, status: 'blocked' },
          { onConflict: 'user_id,friend_id' }
        );
      if (error) {
        log.error('block failed', error.message);
        throw new Error(error.message);
      }
      return true;
    }
  );
}
