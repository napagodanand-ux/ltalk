import { useNavigate } from 'react-router-dom';
import { MessageSquare, Users, Settings, LogOut } from 'lucide-react';

import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { ConversationList } from '../contacts/ConversationList';
import { FriendsList } from '../friends/FriendsList';
import { NewConversationModal } from '../friends/NewConversationModal';
import { Avatar, IconButton } from '../ui';
import { cn } from '../../lib/helpers';

export default function Sidebar() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const activePanel = useUiStore((s) => s.activePanel);
  const setActivePanel = useUiStore((s) => s.setActivePanel);

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
    <aside className="lt-panel flex h-full w-[280px] shrink-0 flex-col">
      <div className="flex items-center gap-1 border-b border-edge px-2 py-2">
        <button onClick={() => setActivePanel('chats')} className={navButtonClass(activePanel === 'chats')}>
          <MessageSquare size={16} /> Chats
        </button>
        <button onClick={() => setActivePanel('friends')} className={navButtonClass(activePanel === 'friends')}>
          <Users size={16} /> Friends
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
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

      <NewConversationModal />
    </aside>
  );
}
