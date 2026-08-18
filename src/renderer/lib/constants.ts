export const ROUTES = {
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  app: '/app',
  settings: '/app/settings',
  profile: '/app/profile'
} as const;

export const STORAGE_BUCKET = 'media';

export const AVATAR_PATH = (userId: string) => `avatars/${userId}`;
export const MEDIA_PATH = (conversationId: string) => `conversations/${conversationId}`;

export const APP_MENU_CHANNELS = {
  newConversation: 'menu:new-conversation',
  search: 'menu:search',
  settings: 'menu:settings',
  toggleTheme: 'menu:toggle-theme',
  checkUpdates: 'menu:check-updates'
} as const;

export const REALTIME_EVENTS = {
  typing: 'typing',
  presence: 'presence'
} as const;
