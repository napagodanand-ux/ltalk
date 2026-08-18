import { create } from 'zustand';

export interface ToastItem {
  id: string;
  title?: string;
  body: string;
  conversationId?: string;
  variant?: 'default' | 'error';
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random()}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = makeId();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // Safety net so a toast is always dismissed even if Radix's own timer
    // doesn't fire (e.g. when the tab is backgrounded).
    setTimeout(() => get().dismiss(id), 6000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}));
