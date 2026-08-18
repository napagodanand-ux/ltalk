import { ipcMain, IpcMainInvokeEvent, Notification } from 'electron';

import { IPC } from '../lib/constants';
import { log } from '../logger';

export function registerNotificationHandlers(): void {
  ipcMain.handle(
    IPC.notifications.send,
    (_event: IpcMainInvokeEvent, title: string, body: string) => {
      try {
        if (!Notification.isSupported()) {
          log.warn('Native notifications are not supported on this platform');
          return false;
        }
        new Notification({ title, body, silent: false }).show();
        return true;
      } catch (error) {
        log.error('Failed to send notification', error);
        return false;
      }
    }
  );

  ipcMain.handle(IPC.notifications.permission, (): boolean => Notification.isSupported());
}

export function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  try {
    new Notification({ title, body }).show();
  } catch (error) {
    log.error('Failed to send notification', error);
  }
}
