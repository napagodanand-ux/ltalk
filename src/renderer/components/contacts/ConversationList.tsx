import { useNavigate } from 'react-router-dom';

import { useConversationStore } from '../../stores/conversationStore';
import { useUiStore } from '../../stores/uiStore';
import { ROUTES } from '../../lib/constants';
import { ConversationItem } from './ConversationItem';

export function ConversationList() {
  const navigate = useNavigate();
  const conversations = useConversationStore((s) => s.conversations);
  const select = useConversationStore((s) => s.select);
  const setRightPanel = useUiStore((s) => s.setRightPanel);

  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-content-muted">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="py-1">
      {conversations.map((c) => (
        <ConversationItem
          key={c.id}
          conversation={c}
          onSelect={() => {
            select(c.id);
            setRightPanel(false);
            navigate(ROUTES.app);
          }}
        />
      ))}
    </div>
  );
}
