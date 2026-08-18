import { useUiStore } from '../../stores/uiStore';
import { Spinner } from '../ui';

// Full-screen launch splash. Covers the app while the auto-updater runs its
// initial check so the user sees a single "starting up" surface instead of a
// flash of the login screen behind it.
export function UpdateSplash() {
  const visible = useUiStore((s) => s.splashVisible);
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-bg-primary">
      <div className="flex items-center gap-2 text-2xl font-semibold text-text-primary">
        <span className="text-accent">LTalk</span>
      </div>
      <Spinner />
      <p className="text-sm text-text-secondary">Starting up — checking for updates…</p>
    </div>
  );
}
