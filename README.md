# LTalk

Secure desktop messaging application built with **Electron + React + TypeScript + Supabase**.

LTalk combines WhatsApp-style messaging with Instagram-style authentication and social
features, with end-to-end encryption (ECDH P-256 + AES-256-GCM) and a desktop-native UI.

## Features

- Email/username authentication via Supabase Auth
- 1-on-1 and group conversations
- End-to-end encrypted messages (pairwise ECDH key exchange, AES-256-GCM)
- Media, file, and voice attachments (Supabase Storage)
- Friend system with requests and blocking
- Real-time messaging, typing indicators, presence
- Desktop-native UI: 3-panel layout, custom title bar, context menus, keyboard shortcuts, system tray, native notifications
- Auto-updates via GitHub Releases

## Development

```bash
npm install
cp .env.example .env   # fill in your Supabase URL and anon key
npm run dev
```

Apply `supabase/schema.sql` in the Supabase SQL editor before first run.

## Build

```bash
npm run dist:win      # NSIS installer + portable
npm run dist:linux    # AppImage + .deb
```

## Project structure

- `src/main` — Electron main process (window, menu, tray, IPC, updater)
- `src/preload` — Secure context bridge
- `src/renderer` — React UI (components, stores, lib)
- `src/shared` — Shared types and constants

## Security

- All business logic is protected by Supabase Row Level Security.
- E2EE private keys are stored with Electron `safeStorage`.
- No debug code or console output is shipped in production builds.
