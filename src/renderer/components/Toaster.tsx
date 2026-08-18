import { useNavigate } from 'react-router-dom';

import { ToastProvider, ToastViewport, Toast } from './ui';
import { useToastStore } from '../stores/toastStore';
import { useConversationStore } from '../stores/conversationStore';
import { ROUTES } from '../lib/constants';

// App-wide in-app notifications. These fire for every incoming message so the
// user is never left guessing (covers the gap when the OS notification doesn't
// surface — e.g. Linux without a desktop entry, or web without permission).
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const navigate = useNavigate();

  return (
    <ToastProvider swipeDirection="right" duration={6000}>
      <ToastViewport />
      {toasts.map((t) => (
        <Toast
          key={t.id}
          title={t.title}
          message={t.body}
          variant={t.variant}
          open
          onClick={() => {
            if (t.conversationId) {
              useConversationStore.getState().select(t.conversationId);
              navigate(ROUTES.app);
            }
            dismiss(t.id);
          }}
          onOpenChange={(open) => {
            if (!open) dismiss(t.id);
          }}
        />
      ))}
    </ToastProvider>
  );
}
