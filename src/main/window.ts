import { app, BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';

import { WINDOW_DEFAULTS } from './lib/constants';
import { supabase as authSupabase } from './lib/supabase';

let mainWindow: BrowserWindow | null = null;
// When true the next window 'close' is allowed to proceed to a full quit
// (set by the tray "Quit" action via app 'before-quit').
let forceQuit = false;
// Guards the offline sync so it runs at most once per quit.
let offlineSynced = false;

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

  // On a real quit (tray "Quit" / OS terminate) the renderer's beforeunload
  // presence write is unreliable — the async request is torn down before it
  // reaches the server, so the profile stays "away". The main process is still
  // alive here, so we synchronously block the quit, push "offline", then quit.
  app.on('before-quit', (event: Electron.Event) => {
    forceQuit = true;
    if (offlineSynced) return;
    event.preventDefault();
    offlineSynced = true;
    const finish = () => app.quit();
    void (async () => {
      try {
        const {
          data: { session }
        } = await authSupabase.auth.getSession();
        const userId = session?.user?.id;
        if (userId) {
          await authSupabase
            .from('profiles')
            .update({ status: 'offline', last_seen: new Date().toISOString() })
            .eq('id', userId);
        }
      } catch {
        /* best effort */
      } finally {
        setTimeout(finish, 300);
      }
    })();
    // Safety net: never hang the quit if the network stalls.
    setTimeout(finish, 2000);
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
