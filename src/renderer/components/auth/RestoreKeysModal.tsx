import { useState } from 'react';
import { Lock } from 'lucide-react';

import { useAuthStore } from '../../stores/authStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useMessageStore } from '../../stores/messageStore';
import { Button, Input } from '../ui';

export function RestoreKeysModal() {
  const pending = useAuthStore((s) => s.pendingRestore);
  const error = useAuthStore((s) => s.restoreError);
  const restore = useAuthStore((s) => s.restoreWithPassword);
  const reset = useAuthStore((s) => s.resetEncryption);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'restore' | 'reset'>('restore');

  if (!pending) return null;

  const submit = async () => {
    if (!password) return;
    setBusy(true);
    const ok = await restore(password);
    setBusy(false);
    if (ok) {
      setPassword('');
      setMode('restore');
      // The key just became available, but messages already loaded were
      // decrypted before it existed and are cached as "🔒 Encrypted message".
      // Re-decrypt the open conversation so it reflects the restored key.
      const activeId = useConversationStore.getState().activeId;
      if (activeId) await useMessageStore.getState().load(activeId);
    }
  };

  const doReset = async () => {
    if (!password) return;
    setBusy(true);
    const ok = await reset(password);
    setBusy(false);
    if (ok) {
      setPassword('');
      setMode('restore');
      const activeId = useConversationStore.getState().activeId;
      if (activeId) await useMessageStore.getState().load(activeId);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-[360px] rounded-lg border border-edge bg-surface p-5 shadow-panel">
        <div className="mb-3 flex items-center gap-2">
          <Lock size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-content">Restore encryption keys</h2>
        </div>
        {mode === 'restore' ? (
          <>
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
            <button
              type="button"
              className="mt-3 w-full text-center text-xs text-content-secondary hover:text-content"
              onClick={() => {
                setMode('reset');
                setPassword('');
              }}
            >
              Lost access to your old key? Reset encryption keys instead
            </button>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-content-secondary">
              This generates a brand-new encryption key and republishes it, re-encrypting your
              recovery key with your <strong>current</strong> password. Your old messages can no
              longer be read, but new messages will work. Use this only if you changed your account
              password after signing up.
            </p>
            <Input
              type="password"
              autoFocus
              placeholder="Current account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void doReset();
              }}
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <Button
              className="mt-4 h-9 w-full"
              onClick={() => void doReset()}
              disabled={busy || !password}
            >
              {busy ? 'Resetting…' : 'Reset & re-encrypt'}
            </Button>
            <button
              type="button"
              className="mt-3 w-full text-center text-xs text-content-secondary hover:text-content"
              onClick={() => {
                setMode('restore');
                setPassword('');
              }}
            >
              Back to restore
            </button>
          </>
        )}
      </div>
    </div>
  );
}
