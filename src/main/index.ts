import { app, ipcMain, BrowserWindow } from 'electron';
import { is } from '@electron-toolkit/utils';

import { createWindow, getMainWindow } from './window';
import { createMenu } from './menu';
import { createTray, setTrayBadge } from './tray';
import { initUpdater, checkForUpdates } from './updater';
import { log } from './logger';

import { registerAuthHandlers } from './ipc/auth';
import { registerStorageHandlers } from './ipc/storage';
import { registerWindowHandlers } from './ipc/window';
import { registerNotificationHandlers } from './ipc/notifications';
import { registerMessageHandlers } from './ipc/messages';
import { registerFriendshipHandlers } from './ipc/friendships';
import { IPC } from './lib/constants';

function registerIpc(): void {
  registerAuthHandlers();
  registerStorageHandlers();
  registerWindowHandlers();
  registerNotificationHandlers();
  registerMessageHandlers();
  registerFriendshipHandlers();

  ipcMain.on(IPC.tray.setBadge, (_event, count: number) => {
    setTrayBadge(count);
  });

  ipcMain.handle(IPC.updates.check, () => {
    checkForUpdates();
    return true;
  });

  ipcMain.handle(IPC.updates.install, async () => {
    const { installUpdate } = await import('./updater');
    installUpdate();
  });

  ipcMain.handle(IPC.app.version, () => app.getVersion());
}

function bootstrap(): void {
  // Required on Windows so native toast notifications are associated with the
  // app (otherwise they may be suppressed or shown as a generic sender).
  app.setAppUserModelId('com.ltalk.app');

  registerIpc();
  createWindow();
  createMenu();
  createTray();
  initUpdater();

  log.info(`LTalk ${app.getVersion()} started`);
}

app.whenReady().then(bootstrap).catch((error) => {
  log.error('Failed to start LTalk', error);
});

app.on('activate', () => {
  const window = getMainWindow();
  if (window) {
    window.show();
    window.focus();
    return;
  }
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Keep LTalk running in the background after the window is closed so that
// notifications and realtime updates keep working. The app is only fully
// quit through the tray "Quit" action (which triggers 'before-quit').
app.on('window-all-closed', () => {
  /* keep running */
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection', reason);
});

if (is.dev) {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
}

// Silence harmless Chromium/GPU warnings on Linux under Wayland:
//   - libva "iHD_drv_video.so init failed" (VA-API hardware video decode)
//   - wayland_wp_color_manager "Unable to set image transfer function"
// Disabling the GPU process removes the code paths that emit these; the app
// still renders fine via software compositing. Gated so other platforms are
// unaffected.
if (process.platform === 'linux' && process.env['XDG_SESSION_TYPE'] === 'wayland') {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder,UseChromeOSDirectVideoDecoder');
}
