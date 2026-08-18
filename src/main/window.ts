import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';

import { WINDOW_DEFAULTS } from './lib/constants';

let mainWindow: BrowserWindow | null = null;
// When true the next window 'close' is allowed to proceed to a full quit
// (set by the tray "Quit" action via app 'before-quit').
let forceQuit = false;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createWindow(): BrowserWindow {
  const { width, height, minWidth, minHeight } = WINDOW_DEFAULTS;

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#800020',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (is.dev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Closing the window keeps LTalk running in the background (system tray) so
  // notifications keep arriving. A real quit comes from the tray "Quit" item,
  // which sets forceQuit via the 'before-quit' event below.
  mainWindow.on('close', (event: Electron.Event) => {
    if (!forceQuit) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  app.on('before-quit', () => {
    forceQuit = true;
  });

  return mainWindow;
}

export function centerOnPrimary(window: BrowserWindow): void {
  const { width, height } = window.getBounds();
  const primary = screen.getPrimaryDisplay().workAreaSize;
  window.setBounds({
    x: Math.round((primary.width - width) / 2),
    y: Math.round((primary.height - height) / 2),
    width,
    height
  });
}
