import { useState } from 'react';
import { Lock } from 'lucide-react';

import { useAuthStore } from '../../stores/authStore';
import { useConversationStore } from '../../stores/conversationStore';
import { useMessageStore } from '../../stores/messageStore';
import { Button, Input } from '../ui';

export function RestoreKeysModal() {
  const pending = useAuthStore((s) => s.pendingRestore);
  const error = useAuthStore((s) => s.restoreError);
  const unrecoverable = useAuthStore((s) => s.backupUnrecoverable);
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

  // When the backup can't be unlocked (e.g. the account password changed after
  // sign-up), "Restore" will never succeed — surface Reset as the primary path.
  const startInReset = unrecoverable && mode === 'restore';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-[360px] rounded-lg border border-edge bg-surface p-5 shadow-panel">
        <div className="mb-3 flex items-center gap-2">
          <Lock size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-content">Restore encryption keys</h2>
        </div>
        {startInReset ? (
          <>
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
              Your saved encryption key can’t be unlocked with this password — most likely because
              your account password was changed after you signed up. Enter your <strong>current</strong>{" "}
              password to reset your keys so messages work again. (Old messages sent before this
              can’t be recovered.)
            </div>
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
              Try restoring with the old password instead
            </button>
          </>
        ) : mode === 'restore' ? (
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
