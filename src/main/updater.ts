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
  // Download updates automatically once they're found (the UI then offers an
  // "Install & restart" action). Without this, the app only ever reported
  // "update available" and never fetched/installed anything.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = log;

  autoUpdater.on('checking-for-update', () => notifyRenderer('checking', null));
  autoUpdater.on('update-available', (info) => notifyRenderer('available', info));
  autoUpdater.on('update-not-available', (info) => notifyRenderer('not-available', info));
  autoUpdater.on('download-progress', (progress) => notifyRenderer('progress', progress));
  autoUpdater.on('update-downloaded', (info) => notifyRenderer('downloaded', info));
  autoUpdater.on('error', (err) => notifyRenderer('error', err.message));

  // Look for updates on launch so the download starts in the background and the
  // user is prompted to restart once it's ready.
  checkForUpdates();

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
