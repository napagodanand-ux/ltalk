import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';

import { cn } from '../../lib/helpers';

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline';
}) {
  const variants = {
    primary: 'lt-button lt-button-primary',
    ghost: 'lt-button lt-button-ghost',
    outline: 'lt-button border border-edge text-content'
  };
  return <button className={cn(variants[variant], className)} {...props} />;
}

export function IconButton({
  className,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-content-secondary hover:bg-surface-hover hover:text-content',
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('lt-input w-full', className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn('lt-input w-full resize-none', className)}
      {...props}
    />
  );
}

export function Avatar({
  src,
  name,
  size = 36,
  status,
  className
}: {
  src?: string | null;
  name: string;
  size?: number;
  status?: 'online' | 'offline' | 'away';
  className?: string;
}) {
  const initial = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary/20 text-primary"
        style={{ fontSize: size * 0.4 }}
      >
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-bg',
            status === 'online'
              ? 'bg-green-500'
              : status === 'away'
                ? 'bg-amber-400'
                : 'bg-gray-400'
          )}
          style={{ width: Math.max(8, size * 0.3), height: Math.max(8, size * 0.3) }}
        />
      )}
    </div>
  );
}

export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalClose = DialogPrimitive.Close;

export function ModalContent({
  className,
  children,
  title,
  hideClose
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-edge bg-surface p-5 shadow-panel',
          className
        )}
      >
        {title && (
          <DialogPrimitive.Title className="mb-4 text-base font-semibold">
            {title}
          </DialogPrimitive.Title>
        )}
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-3 top-3 text-content-muted hover:text-content">
            <X size={16} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function ContextMenu({
  trigger,
  children
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{trigger}</ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className="z-50 min-w-[180px] rounded-md border border-edge bg-surface p-1 shadow-panel">
          {children}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}

export function ContextMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-content outline-none data-[highlighted]:bg-surface-hover',
        className
      )}
      {...props}
    />
  );
}

// Click-triggered dropdown menu (as opposed to ContextMenu, which only opens on
// right-click). Used for "Options"-style buttons where a left-click should open
// the menu.
export function DropdownMenu({
  trigger,
  children
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div
        className="w-full"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {trigger}
      </div>
      {open && (
        <div className="absolute left-0 z-50 mt-1 min-w-[180px] rounded-md border border-edge bg-surface p-1 shadow-panel">
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  className,
  onSelect,
  children,
  ...props
}: { className?: string; onSelect?: () => void; children?: React.ReactNode } & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onSelect'
>) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-content outline-none hover:bg-surface-hover',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="z-50 rounded bg-bg-tertiary px-2 py-1 text-xs text-content shadow-panel">
            {label}
            <TooltipPrimitive.Arrow className="fill-bg-tertiary" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-edge border-t-primary"
      style={{ width: size, height: size }}
    />
  );
}

export const ToastProvider = ToastPrimitive.Provider;

export function ToastViewport() {
  return (
    <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 outline-none" />
  );
}

export function Toast({
  title,
  message,
  open,
  onOpenChange,
  onClick,
  variant
}: {
  title?: string;
  message: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClick?: () => void;
  variant?: 'default' | 'error';
}) {
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md border bg-surface px-4 py-3 text-sm text-content shadow-panel',
        variant === 'error' ? 'border-red-500' : 'border-edge'
      )}
    >
      {title && <div className="mb-0.5 font-medium text-content">{title}</div>}
      <div className="text-content-secondary">{message}</div>
    </ToastPrimitive.Root>
  );
}
