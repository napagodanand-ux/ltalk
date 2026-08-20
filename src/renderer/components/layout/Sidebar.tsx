import { useNavigate } from 'react-router-dom';
import { MessageSquare, Users, Settings, LogOut, Search, MessageSquarePlus, Sun, Moon } from 'lucide-react';

import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { ConversationList } from '../contacts/ConversationList';
import { FriendsList } from '../friends/FriendsList';
import { Avatar, IconButton } from '../ui';
import { cn } from '../../lib/helpers';
import { useIsMobile } from '../../lib/hooks';

export default function Sidebar({ className }: { className?: string }) {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const activePanel = useUiStore((s) => s.activePanel);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const setNewConversationOpen = useUiStore((s) => s.setNewConversationOpen);
  const isMobile = useIsMobile();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navButtonClass = (active: boolean) =>
    cn(
      'flex h-8 flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium',
      active
        ? 'bg-surface-hover text-primary'
        : 'text-content-secondary hover:bg-surface-hover hover:text-content'
    );

  return (
    <aside className={cn('lt-panel relative flex h-full shrink-0 flex-col', className)}>
      {isMobile && (
        <div className="wa-header flex items-center gap-2 px-4 py-3">
          <span className="text-lg font-semibold">LTalk</span>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Search" onClick={() => setSearchOpen(true)}>
              <Search size={20} />
            </IconButton>
            <IconButton
              label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </IconButton>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-edge px-2 py-2">
        <button onClick={() => setActivePanel('chats')} className={navButtonClass(activePanel === 'chats')}>
          <MessageSquare size={16} /> Chats
        </button>
        <button onClick={() => setActivePanel('friends')} className={navButtonClass(activePanel === 'friends')}>
          <Users size={16} /> Friends
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        {activePanel === 'chats' ? <ConversationList /> : <FriendsList />}
      </div>

      {profile && (
        <div className="flex items-center gap-2 border-t border-edge px-3 py-2">
          <Avatar src={profile.avatar_url} name={profile.display_name || profile.username} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-content">
              {profile.display_name || profile.username}
            </div>
            <div className="truncate text-xs text-content-muted">@{profile.username}</div>
          </div>
          <IconButton label="Settings" onClick={() => navigate('/app/settings')}>
            <Settings size={16} />
          </IconButton>
          <IconButton label="Log out" onClick={handleLogout}>
            <LogOut size={16} />
          </IconButton>
        </div>
      )}

      {isMobile && (
        <button
          type="button"
          aria-label="New chat"
          onClick={() => setNewConversationOpen(true, 'dm')}
          className="wa-fab absolute bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full"
        >
          <MessageSquarePlus size={26} />
        </button>
      )}
    </aside>
  );
}
