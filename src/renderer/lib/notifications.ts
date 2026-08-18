// Unified notification layer that works in both the Electron shell and the
// plain web build. In Electron we delegate to the native OS notification API
// via the preload bridge; in a browser we use the Web Notifications API.
//
// IMPORTANT: we must distinguish the *real* Electron bridge from the web
// fallback shim. The shim also exposes `window.electron.notifications`, but its
// `send` only *checks* permission — it never calls `Notification.requestPermission()`
// — so on the web build we must bypass it and use the real browser API, which is
// what actually prompts for and persists the grant.

export type NotificationState = 'unsupported' | 'granted' | 'denied' | 'default';

interface NotifyOptions {
  title: string;
  body: string;
  tag?: string;
}

const FALLBACK_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23a855f7"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-5-5.91V4a1 1 0 1 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>'
  );

function isRealElectron(): boolean {
  return Boolean(window.electron?.isElectron && window.electron.notifications);
}

export async function getNotificationSupport(): Promise<boolean> {
  if (isRealElectron()) {
    try {
      return await window.electron!.notifications!.permission();
    } catch {
      return false;
    }
  }
  return typeof Notification !== 'undefined' && Notification.permission !== 'denied';
}

export function getNotificationState(): NotificationState {
  if (isRealElectron()) {
    return 'granted';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotificationState;
}

// Requests permission from the user. In Electron the OS prompt appears the
// first time a native notification is shown, so we send a short confirmation
// notification to both trigger that prompt and prove the channel works. On the
// web we call the real `Notification.requestPermission()`, which prompts and
// persists the grant in the browser.
export async function requestNotificationPermission(): Promise<boolean> {
  if (isRealElectron()) {
    const supported = await getNotificationSupport();
    if (!supported) return false;
    try {
      await window.electron!.notifications!.send(
        'Notifications enabled',
        "You'll be notified about new messages on LTalk."
      );
    } catch {
      /* best effort */
    }
    return true;
  }

  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

export async function notify({ title, body, tag }: NotifyOptions): Promise<void> {
  if (isRealElectron()) {
    try {
      await window.electron!.notifications!.send(title, body);
    } catch {
      /* best effort */
    }
    return;
  }

  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag, icon: FALLBACK_ICON });
  } catch {
    /* best effort */
  }
}
