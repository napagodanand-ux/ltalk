import { app } from 'electron';
import path from 'node:path';
import { is } from '@electron-toolkit/utils';

import { APP_NAME, STORE_KEYS, IPC, MESSAGES_PER_PAGE, E2EE, FRIEND_ONLY_CONVERSATIONS } from '../../shared/constants';

export { APP_NAME, STORE_KEYS, IPC, MESSAGES_PER_PAGE, E2EE, FRIEND_ONLY_CONVERSATIONS };

export const APP_VERSION = app.getVersion();

export const WINDOW_DEFAULTS = {
  width: 1200,
  height: 800,
  minWidth: 900,
  minHeight: 600
};

export const isDev = is.dev;

export const RESOURCES_PATH = isDev
  ? path.join(process.cwd(), 'assets')
  : path.join(process.resourcesPath, 'assets');

export const ICONS_PATH = path.join(RESOURCES_PATH, 'icons');
