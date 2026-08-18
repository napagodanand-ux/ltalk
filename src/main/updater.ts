import { autoUpdater } from 'electron-updater';
import { is } from '@electron-toolkit/utils';

import { getMainWindow } from './window';
import { log } from './logger';

function notifyRenderer(event: string, payload: unknown): void {
  const window = getMainWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send('updater:event', { event, payload });
  }
}

export function initUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = log;

  autoUpdater.on('checking-for-update', () => notifyRenderer('checking', null));
  autoUpdater.on('update-available', (info) => notifyRenderer('available', info));
  autoUpdater.on('update-not-available', (info) => notifyRenderer('not-available', info));
  autoUpdater.on('download-progress', (progress) => notifyRenderer('progress', progress));
  autoUpdater.on('update-downloaded', (info) => notifyRenderer('downloaded', info));
  autoUpdater.on('error', (err) => notifyRenderer('error', err.message));

  log.info('Auto-updater initialized');
}

export function checkForUpdates(): void {
  if (is.dev) {
    log.info('Skipping update check in development');
    return;
  }
  autoUpdater
    .checkForUpdatesAndNotify()
    .catch((error) => log.error('Update check failed', error));
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
