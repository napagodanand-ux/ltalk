import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, LogOut, RefreshCw, User, Bell } from 'lucide-react';

import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui';
import { ROUTES } from '../../lib/constants';
import { notify, requestNotificationPermission } from '../../lib/notifications';
import type { ThemeName } from '../../../../src/shared/types';

interface UpdaterEvent {
  event?: string;
  payload?: unknown;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  // The web build updates itself via GitHub Pages, so the desktop auto-updater
  // UI is irrelevant there.
  const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;

  useEffect(() => {
    window.electron.app.version().then(setAppVersion).catch(() => setAppVersion(null));
  }, []);

  useEffect(() => {
    const unsubscribe = window.electron.on('updater:event', (...args: unknown[]) => {
      const data = args[0] as UpdaterEvent | undefined;
      const evt = data?.event;
      const payload = data?.payload as { version?: string; percent?: number } | undefined;
      if (evt === 'available') {
        setUpdateReady(false);
        setDownloadProgress(0);
        setUpdateVersion(payload?.version ?? null);
        setUpdateStatus('Update available');
      } else if (evt === 'progress') {
        setDownloadProgress(payload?.percent ?? 0);
        setUpdateStatus('Downloading…');
      } else if (evt === 'downloaded') {
        setUpdateReady(true);
        setDownloadProgress(100);
        setUpdateStatus('Update ready to install');
      } else if (evt === 'not-available') {
        setUpdateReady(false);
        setDownloadProgress(0);
        setUpdateStatus('Up to date');
      } else if (evt === 'checking') {
        setUpdateStatus('Checking…');
      } else if (evt === 'error') {
        setUpdateReady(false);
        setUpdateStatus(typeof data?.payload === 'string' ? data.payload : 'Update check failed');
      }
    });
    return unsubscribe;
  }, []);

  const handleCheckUpdates = async () => {
    setChecking(true);
    setUpdateStatus(null);
    setUpdateReady(false);
    setDownloadProgress(0);
    try {
      await window.electron.updates.check();
    } catch (err) {
      setUpdateStatus(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setChecking(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await window.electron.updates.install();
    } catch {
      /* ignored */
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate(ROUTES.login);
  };

  const handleTestNotification = async () => {
    const ok = await requestNotificationPermission();
    if (!ok) {
      setNotifMsg('Notifications are blocked in your browser or OS settings.');
      return;
    }
    setNotifMsg(null);
    await notify({
      title: 'LTalk',
      body: 'This is what a new-message notification looks like.',
      tag: 'test'
    });
  };

  const themeOptions: ThemeName[] = ['light', 'dark'];

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[560px] p-6">
        <h1 className="mb-4 text-base font-semibold text-content">Settings</h1>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-edge bg-surface p-5 shadow-panel">
            <h2 className="mb-3 text-sm font-semibold text-content">Appearance</h2>
            <div className="flex items-center gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTheme(option)}
                  className={
                    'flex h-8 flex-1 items-center justify-center gap-2 rounded-md border text-sm capitalize ' +
                    (theme === option
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-edge text-content-secondary hover:bg-surface-hover')
                  }
                >
                  {option === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                  {option}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-content-muted">
              Current theme: <span className="capitalize text-content-secondary">{theme}</span>
            </p>
          </section>

          <section className="rounded-xl border border-edge bg-surface p-5 shadow-panel">
            <h2 className="mb-3 text-sm font-semibold text-content">Account</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-content-muted">Display name</dt>
                <dd className="text-content">{profile?.display_name || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-content-muted">Username</dt>
                <dd className="text-content">{profile?.username || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-content-muted">Email</dt>
                <dd className="text-content">{user?.email || '—'}</dd>
              </div>
            </dl>
            <Button
              variant="outline"
              className="mt-3 flex h-8 items-center gap-2"
              onClick={() => navigate(ROUTES.profile)}
            >
              <User size={14} />
              Edit profile
            </Button>
          </section>

          <section className="rounded-xl border border-edge bg-surface p-5 shadow-panel">
            <h2 className="mb-3 text-sm font-semibold text-content">Privacy &amp; encryption</h2>
            <p className="text-sm text-content-secondary">
              Messages are end-to-end encrypted. Your encryption key is secured with your account
              password and synced automatically across your devices when you sign in, so you can
              read your conversations on any of them.
            </p>
          </section>

          {isElectron && (
            <section className="rounded-xl border border-edge bg-surface p-5 shadow-panel">
              <h2 className="mb-3 text-sm font-semibold text-content">Updates</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="flex h-8 items-center gap-2"
                  onClick={handleCheckUpdates}
                  disabled={checking || updateReady}
                >
                  <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
                  Check for updates
                </Button>
                {updateReady && (
                  <Button className="flex h-8 items-center gap-2" onClick={handleInstallUpdate}>
                    Install &amp; restart
                  </Button>
                )}
              </div>

              {updateReady ? (
                <p className="mt-2 text-xs text-content-secondary">
                  Update ready{updateVersion ? ` (v${updateVersion})` : ''} — restart to apply.
                </p>
              ) : downloadProgress > 0 && downloadProgress < 100 ? (
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-200"
                      style={{ width: `${Math.round(downloadProgress)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-content-secondary">
                    Downloading… {Math.round(downloadProgress)}%
                  </p>
                </div>
              ) : updateStatus ? (
                <p className="mt-2 text-xs text-content-secondary">{updateStatus}</p>
              ) : null}
            </section>
          )}

          <section className="rounded-xl border border-edge bg-surface p-5 shadow-panel">
            <h2 className="mb-3 text-sm font-semibold text-content">About</h2>
            <p className="text-sm text-content">LTalk</p>
            <p className="mt-1 text-xs text-content-muted">
              A secure, end-to-end encrypted desktop messenger.
            </p>
            <p className="mt-2 text-xs text-content-muted">
              Version <span className="text-content-secondary">{appVersion ?? '…'}</span>
              {isElectron && <span className="ml-1 text-content-muted">(desktop app)</span>}
            </p>
          </section>

          <section className="rounded-xl border border-edge bg-surface p-5 shadow-panel">
            <h2 className="mb-3 text-sm font-semibold text-content">Notifications</h2>
            <Button
              variant="outline"
              className="flex h-8 items-center gap-2"
              onClick={handleTestNotification}
            >
              <Bell size={14} />
              Send a test notification
            </Button>
            {notifMsg && <p className="mt-2 text-xs text-red-400">{notifMsg}</p>}
          </section>

          <section className="rounded-xl border border-edge bg-surface p-5 shadow-panel">
            <h2 className="mb-3 text-sm font-semibold text-content">Session</h2>
            <Button
              variant="ghost"
              className="flex h-8 items-center gap-2 text-red-400 hover:bg-red-400/10"
              onClick={handleSignOut}
            >
              <LogOut size={14} />
              Sign out
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
