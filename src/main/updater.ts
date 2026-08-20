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
  // We don't auto-download: optional updates wait for the user to accept, while
  // forced updates are downloaded immediately by the renderer once it decides
  // the update is mandatory (see the splash/update dialog flow).
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = log;

  autoUpdater.on('checking-for-update', () => notifyRenderer('checking', null));
  autoUpdater.on('update-available', (info) => notifyRenderer('available', info));
  autoUpdater.on('update-not-available', (info) => notifyRenderer('not-available', info));
  autoUpdater.on('download-progress', (progress) => notifyRenderer('progress', progress));
  autoUpdater.on('update-downloaded', (info) => notifyRenderer('downloaded', info));
  autoUpdater.on('error', (err) => notifyRenderer('error', err.message));

  // Look for updates on launch so the user is prompted if one exists.
  checkForUpdates();

  log.info('Auto-updater initialized');
}

export function checkForUpdates(): void {
  if (is.dev) {
    log.info('Skipping update check in development');
    return;
  }
  autoUpdater.checkForUpdates().catch((error) => log.error('Update check failed', error));
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((error) => log.error('Update download failed', error));
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
