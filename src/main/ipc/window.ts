import { ipcMain } from 'electron';

import { IPC } from '../lib/constants';
import { getMainWindow } from '../window';

export function registerWindowHandlers(): void {
  ipcMain.on(IPC.window.minimize, () => {
    const window = getMainWindow();
    if (window) window.minimize();
  });

  ipcMain.on(IPC.window.maximize, () => {
    const window = getMainWindow();
    if (!window) return;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.on(IPC.window.restore, () => {
    getMainWindow()?.unmaximize();
  });

  ipcMain.on(IPC.window.close, () => {
    const window = getMainWindow();
    if (window) window.close();
  });

  ipcMain.handle(IPC.window.isMaximized, (): boolean => {
    return getMainWindow()?.isMaximized() ?? false;
  });
}
