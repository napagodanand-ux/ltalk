import { Tray, Menu, app, nativeImage } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';

import { getMainWindow } from './window';
import { ICONS_PATH } from './lib/constants';
import { log } from './logger';

let tray: Tray | null = null;

function showWindow(): void {
  const window = getMainWindow();
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function buildTrayMenu(): Menu {
  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Show LTalk',
      click: showWindow
    },
    {
      label: 'New Message',
      click: () => {
        showWindow();
        getMainWindow()?.webContents.send('menu:new-conversation');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ];
  return Menu.buildFromTemplate(items);
}

export function createTray(): void {
  const iconPath = join(ICONS_PATH, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty() && is.dev) {
    image = nativeImage.createEmpty();
  }

  tray = new Tray(image);
  tray.setToolTip('LTalk');
  tray.setContextMenu(buildTrayMenu());

  tray.on('click', () => {
    const window = getMainWindow();
    if (!window) return;
    if (window.isVisible()) {
      window.hide();
    } else {
      showWindow();
    }
  });

  log.info('System tray created');
}

export function setTrayBadge(count: number): void {
  if (!tray) return;
  tray.setToolTip(count > 0 ? `LTalk (${count} unread)` : 'LTalk');
  if (process.platform === 'darwin') {
    app.setBadgeCount(count);
  }
}

export function getTray(): Tray | null {
  return tray;
}
