import { app } from 'electron';
import path from 'node:path';
import log from 'electron-log/main';

log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024;
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', 'ltalk.log');

log.initialize();

export { log };
