import { useUiStore } from '../../stores/uiStore';
import { Modal, ModalContent } from '../ui';
import { Download, RefreshCw, SkipForward } from 'lucide-react';

// Update prompt shown when the auto-updater finds a new release. Optional
// updates offer Skip (which records the skipped version so the NEXT release is
// forced — the skip-cascade). Forced updates (previous skip, or below the
// server minimum version) only offer "Update now".
export function UpdateDialog() {
  const updateAvailable = useUiStore((s) => s.updateAvailable);
  const updateReady = useUiStore((s) => s.updateReady);
  const progress = useUiStore((s) => s.updateProgress);

  if (!updateAvailable) return null;
  const forced = updateAvailable.forced;

  const onUpdate = async () => {
    if (!window.electron) return;
    if (updateReady) {
      // Clear the skip marker so future releases are optional again, then quit
      // and apply the downloaded update.
      try {
        await window.electron.storage.delete('app.skippedUpdate');
      } catch {
        /* non-fatal */
      }
      void window.electron.updates.install();
    } else {
      void window.electron.updates.download();
    }
  };

  const onSkip = async () => {
    if (!window.electron) return;
    try {
      await window.electron.storage.set('app.skippedUpdate', updateAvailable.version);
    } catch {
      /* non-fatal */
    }
    useUiStore.getState().setUpdateAvailable(null);
  };

  const requestClose = (open: boolean) => {
    if (!open && !forced) onSkip();
  };

  return (
    <Modal open onOpenChange={requestClose}>
      <ModalContent title={forced ? 'Update required' : 'Update available'} hideClose={forced}>
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {forced
              ? `A required update (v${updateAvailable.version}) is ready. You must update to continue using LTalk.`
              : `A new version (v${updateAvailable.version}) is available. Update now or skip this one — skipping means the next release will be required.`}
          </p>

          {progress != null && !updateReady && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.round(progress)}%` }}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            {!forced && (
              <button
                type="button"
                onClick={onSkip}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
              >
                <SkipForward size={14} /> Skip
              </button>
            )}
            <button
              type="button"
              onClick={onUpdate}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {updateReady ? (
                <>
                  <RefreshCw size={14} /> Restart &amp; update
                </>
              ) : (
                <>
                  <Download size={14} /> Update now
                </>
              )}
            </button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
