import { Menu, MenuItemConstructorOptions, app, dialog, shell } from 'electron';

import { getMainWindow } from './window';
import { log } from './logger';

function sendToRenderer(channel: string, ...args: unknown[]): void {
  const window = getMainWindow();
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, ...args);
  }
}

function buildTemplate(): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'New Conversation',
        accelerator: 'CmdOrCtrl+N',
        click: () => sendToRenderer('menu:new-conversation')
      },
      {
        label: 'Search',
        accelerator: 'CmdOrCtrl+F',
        click: () => sendToRenderer('menu:search')
      },
      { type: 'separator' },
      {
        label: 'Settings',
        accelerator: 'CmdOrCtrl+,',
        click: () => sendToRenderer('menu:settings')
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  };

  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  };

  const settingsMenu: MenuItemConstructorOptions = {
    label: 'Settings',
    submenu: [
      {
        label: 'Open Settings',
        accelerator: 'CmdOrCtrl+,',
        click: () => sendToRenderer('menu:settings')
      },
      {
        label: 'Toggle Theme',
        click: () => sendToRenderer('menu:toggle-theme')
      }
    ]
  };

  const helpMenu: MenuItemConstructorOptions = {
    label: 'Help',
    submenu: [
      {
        label: 'Documentation',
        click: async () => {
          await shell.openExternal('https://github.com/anomalyco/ltalk');
        }
      },
      {
        label: 'Check for Updates',
        click: () => sendToRenderer('menu:check-updates')
      },
      { type: 'separator' },
      {
        label: 'About LTalk',
        click: () => {
          dialog.showMessageBox(getMainWindow()!, {
            type: 'info',
            title: 'About LTalk',
            message: 'LTalk',
            detail: `Version ${app.getVersion()}\nSecure desktop messaging.`
          });
        }
      }
    ]
  };

  const template: MenuItemConstructorOptions[] = [fileMenu, editMenu, viewMenu, settingsMenu, helpMenu];

  if (isMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  return template;
}

export function createMenu(): void {
  const template = buildTemplate();
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  log.info('Application menu created');
}
