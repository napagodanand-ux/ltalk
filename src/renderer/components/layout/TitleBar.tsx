import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Square, X, Search, Sun, Moon, MessageSquarePlus, UserPlus, Users } from 'lucide-react';

import { useUiStore } from '../../stores/uiStore';
import { useConversationStore } from '../../stores/conversationStore';
import { IconButton } from '../ui';
import { APP_NAME } from '../../../../src/shared/constants';
import { useIsMobile } from '../../lib/hooks';

export function TitleBar() {
  const navigate = useNavigate();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setNewConversationOpen = useUiStore((s) => s.setNewConversationOpen);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const isMobile = useIsMobile();

  const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;
  const [menuOpen, setMenuOpen] = React.useState(false);

  const chooserItem =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-content hover:bg-surface-hover';

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-edge bg-bg-secondary px-3">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-sm bg-primary" />
        <span className="text-sm font-semibold text-content">{APP_NAME}</span>
      </div>

      <div
        className="hidden flex-1 items-center justify-center md:flex"
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

      <div className="relative flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="relative">
          <IconButton
            label="New"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MessageSquarePlus size={16} />
          </IconButton>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-50 w-48 rounded-md border border-edge bg-surface p-1 shadow-panel">
                <button
                  type="button"
                  className={chooserItem}
                  onClick={() => {
                    setMenuOpen(false);
                    setNewConversationOpen(true, 'dm');
                  }}
                >
                  <MessageSquarePlus size={14} /> New chat
                </button>
                <button
                  type="button"
                  className={chooserItem}
                  onClick={() => {
                    setMenuOpen(false);
                    setNewConversationOpen(true, 'group');
                  }}
                >
                  <Users size={14} /> New group
                </button>
                <button
                  type="button"
                  className={chooserItem}
                  onClick={() => {
                    setMenuOpen(false);
                    if (isMobile) {
                      useConversationStore.getState().select(null);
                      navigate('/app');
                    }
                    setActivePanel('friends');
                  }}
                >
                  <UserPlus size={14} /> Add friend
                </button>
              </div>
            </>
          )}
        </div>
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
