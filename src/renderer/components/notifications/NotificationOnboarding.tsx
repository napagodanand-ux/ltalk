import { useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { Modal, ModalContent, Button, Spinner } from '../ui';
import { useUiStore } from '../../stores/uiStore';
import { requestNotificationPermission } from '../../lib/notifications';

export function NotificationOnboarding() {
  const open = useUiStore((s) => s.notifOnboarding);
  const setOpen = useUiStore((s) => s.setNotifOnboarding);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const finish = async () => {
    try {
      await window.electron.storage.set('app.notifOnboarded', true);
    } catch {
      /* storage unavailable */
    }
    setOpen(false);
  };

  return (
    <Modal open={open} onOpenChange={(v) => !v && setOpen(false)}>
      <ModalContent className="w-[400px] overflow-hidden p-0">
        <DialogPrimitive.Title className="sr-only">Enable notifications</DialogPrimitive.Title>
        <div className="relative flex flex-col items-center px-6 pt-8 pb-6 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-glow">
            <BellRing size={30} />
          </div>

          {done ? (
            <>
              <h2 className="text-lg font-semibold text-content">You're all set</h2>
              <p className="mt-2 text-sm text-content-secondary">
                LTalk will let you know the moment a new message arrives.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-content">Never miss a message</h2>
              <p className="mt-2 text-sm text-content-secondary">
                Turn on notifications to get a discreet alert when friends message you — even
                while LTalk runs quietly in the background.
              </p>
            </>
          )}

          <div className="mt-6 flex w-full flex-col gap-2">
            <Button
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const granted = await requestNotificationPermission();
                setLoading(false);
                if (granted) {
                  setDone(true);
                  setTimeout(() => void finish(), 900);
                }
              }}
              className="flex h-10 items-center justify-center gap-2"
            >
              {loading ? <Spinner size={16} /> : done ? <Check size={16} /> : null}
              {done ? 'Enabled' : 'Enable notifications'}
            </Button>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => void finish()}
              className="h-10"
            >
              Not now
            </Button>
          </div>

          <p className="mt-4 text-xs text-content-muted">
            You can change this anytime in Settings.
          </p>
        </div>
      </ModalContent>
    </Modal>
  );
}
