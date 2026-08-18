import { useUiStore } from '../../stores/uiStore';
import { WifiOff } from 'lucide-react';

// Full-screen, non-blocking indicator shown when the app loses connectivity.
// pointer-events are disabled so the user can still read/scroll local content
// (Discord-style) while the banner explains the connection state.
export function OfflineOverlay() {
  const online = useUiStore((s) => s.online);
  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[150] flex items-start justify-center">
      <div className="mt-3 flex items-center gap-2 rounded-full border border-amber-500/40 bg-bg-secondary/95 px-4 py-2 text-sm text-amber-300 shadow-panel backdrop-blur">
        <WifiOff size={16} />
        <span>You&rsquo;re offline — messages will sync when you reconnect.</span>
      </div>
    </div>
  );
}
