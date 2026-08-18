import * as React from 'react';
import { Minus, Square, X, Search, Sun, Moon, MessageSquarePlus } from 'lucide-react';

import { useUiStore } from '../../stores/uiStore';
import { IconButton } from '../ui';
import { APP_NAME } from '../../../../src/shared/constants';

export function TitleBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setNewConversationOpen = useUiStore((s) => s.setNewConversationOpen);

  const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-edge bg-bg-secondary px-3">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-sm bg-primary" />
        <span className="text-sm font-semibold text-content">{APP_NAME}</span>
      </div>

      <div
        className="flex flex-1 items-center justify-center"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-2 rounded-md bg-bg-tertiary px-3 py-1 text-xs text-content-muted"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Search size={13} />
          <span>Search (Ctrl+F)</span>
        </div>
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <IconButton label="New conversation" onClick={() => setNewConversationOpen(true)}>
          <MessageSquarePlus size={16} />
        </IconButton>
        <IconButton label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>
        {isElectron && (
          <>
            <IconButton label="Minimize" onClick={() => window.electron.window.minimize()}>
              <Minus size={16} />
            </IconButton>
            <IconButton label="Maximize" onClick={() => window.electron.window.maximize()}>
              <Square size={14} />
            </IconButton>
            <IconButton label="Close" onClick={() => window.electron.window.close()}>
              <X size={16} />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );
}
