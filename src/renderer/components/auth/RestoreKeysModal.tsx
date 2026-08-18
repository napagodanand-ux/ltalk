import { useState } from 'react';
import { Lock } from 'lucide-react';

import { useAuthStore } from '../../stores/authStore';
import { Button, Input } from '../ui';

export function RestoreKeysModal() {
  const pending = useAuthStore((s) => s.pendingRestore);
  const error = useAuthStore((s) => s.restoreError);
  const restore = useAuthStore((s) => s.restoreWithPassword);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!pending) return null;

  const submit = async () => {
    if (!password) return;
    setBusy(true);
    const ok = await restore(password);
    setBusy(false);
    if (ok) setPassword('');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-[360px] rounded-lg border border-edge bg-surface p-5 shadow-panel">
        <div className="mb-3 flex items-center gap-2">
          <Lock size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-content">Restore encryption keys</h2>
        </div>
        <p className="mb-3 text-sm text-content-secondary">
          Your messages are end-to-end encrypted with a key from your other device. Enter your
          account password to sync it to this one.
        </p>
        <Input
          type="password"
          autoFocus
          placeholder="Account password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <Button
          className="mt-4 h-9 w-full"
          onClick={() => void submit()}
          disabled={busy || !password}
        >
          {busy ? 'Restoring…' : 'Restore'}
        </Button>
      </div>
    </div>
  );
}
