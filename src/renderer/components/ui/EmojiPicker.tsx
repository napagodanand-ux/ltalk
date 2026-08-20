import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

import { EMOJI_CATEGORIES } from '../../lib/emojis';
import { cn } from '../../lib/helpers';

function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, onOutside]);
}

interface EmojiPanelProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPanel({ onSelect, className }: EmojiPanelProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const matches = q
    ? EMOJI_CATEGORIES.map((c) => ({ name: c.name, emojis: c.emojis })).filter((c) =>
        c.emojis.some((e) => e.includes(q))
      )
    : EMOJI_CATEGORIES;

  return (
    <div className={cn('flex w-[300px] flex-col', className)}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search emoji…"
        className="lt-input mb-2 w-full text-xs"
      />
      <div className="max-h-[240px] overflow-y-auto pr-1">
        {matches.length === 0 && (
          <div className="py-6 text-center text-xs text-content-muted">No emoji found</div>
        )}
        {matches.map((cat) => (
          <div key={cat.name} className="mb-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-content-muted">
              {cat.name}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {cat.emojis.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-surface-hover"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  label?: string;
  className?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
}

export function EmojiPicker({ onSelect, label = 'Emoji', className, align = 'right', disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md text-content-secondary hover:bg-surface-hover hover:text-content disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
          className
        )}
      >
        <Smile size={18} />
      </button>
      {open && (
        <div
          className={cn(
            'absolute bottom-full z-50 mb-2 rounded-lg border border-edge bg-surface p-2 shadow-panel',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <EmojiPanel
            onSelect={(emoji) => {
              onSelect(emoji);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
