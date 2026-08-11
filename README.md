# LTalk

Secure messaging for Linux — end-to-end encrypted with Signal Protocol.

**Stack**: Python 3.11+ · PySide6/QML · Supabase · SQLCipher · Signal Protocol · D-Bus · systemd

## Architecture

```
┌─────────────┐     Unix Socket IPC     ┌─────────────┐     HTTPS/WS     ┌───────────┐
│  ltalk_app   │ ◄─────────────────────► │   ltalkd     │ ◄──────────────► │  Supabase  │
│  (GUI/QML)   │                         │  (Daemon)    │                  │  (Cloud)   │
└─────────────┘                         └─────────────┘                  └───────────┘
      │                                       │
      ▼                                       ▼
  SQLCipher                             SQLCipher
  (local DB)                            (local DB)
```

- **ltalk_app** — PySide6/QML GUI process. Renders the UI, handles user input.
- **ltalkd** — Background daemon. Manages Supabase Realtime, presence, system tray, D-Bus notifications, offline queue.
- **ltalk_core** — Shared library used by both. Crypto, database, IPC protocol, Supabase clients, domain types.

## Features

- End-to-end encryption (Signal Protocol via libsignal)
- Encrypted local database (SQLCipher + keyring-based key management)
- Realtime messaging via Supabase WebSocket
- Offline message queue with retry
- System tray with unread badge
- D-Bus notifications with inline reply
- Typing indicators, message status (sent/delivered/read)
- File/image sharing with drag-and-drop
- Dark/light mode
- Responsive layout (desktop + mobile-width)
- Status/stories with 24h expiry
- Contact management, block/unblock
- Disappearing messages
- systemd user service for the daemon

## Requirements

- Python 3.11+
- System packages: `libsqlcipher-dev`, `libqt6-*` (for PySide6)
- A Supabase project (free tier works)

## Setup

```bash
# Clone
git clone --recurse-submodules https://github.com/nickvdyck/ltalk.git
cd ltalk

# Run the dev setup script (creates venv, installs deps)
./scripts/setup-dev.sh
source venv/bin/activate

# Configure
cp .env.example .env
# Edit .env with your Supabase URL and anon key
```

## Running

```bash
# GUI
python -m ltalk_app.main

# Daemon (background service)
python -m ltalkd.main

# Or install the daemon as a systemd user service
./scripts/install-daemon.sh
```

## Development

```bash
source venv/bin/activate

# Lint
ruff check ltalk_core/ ltalk_app/ ltalkd/

# Type check
mypy ltalk_core/ ltalk_app/ ltalkd/

# Tests
pytest tests/ -v

# Or use make
make lint
make typecheck
make test
make check  # all three
```

## Project Structure

```
ltalk/
├── ltalk_core/           # Shared library
│   ├── crypto/           # Signal Protocol, encryption, key management
│   ├── db/               # SQLCipher database, repos, migrations
│   ├── ipc/              # Unix socket IPC protocol
│   ├── supabase/         # PostgREST, Auth, Realtime, Storage clients
│   └── types/            # Domain types (Chat, Message, etc.)
├── ltalk_app/            # GUI application
│   ├── models/           # Qt list models
│   ├── resources/qml/    # QML UI files
│   ├── backend.py        # QML ↔ Python bridge
│   └── theme.py          # Theme singleton
├── ltalkd/               # Background daemon
│   ├── ipc_server.py     # Unix socket server
│   ├── notification_sender.py  # D-Bus notifications
│   ├── tray_manager.py   # System tray icon
│   ├── presence.py       # Online/offline heartbeats
│   └── realtime_listener.py    # Supabase Realtime
├── tests/                # Test suite
├── scripts/              # Build and setup scripts
├── packaging/            # Flatpak, AppImage manifests
└── supabase_schema.sql   # Database schema + RLS policies
```

## Building

```bash
# AppImage
./scripts/build-appimage.sh

# Flatpak (requires flatpak-builder)
flatpak-builder build-dir packaging/flatpak/org.ltalk.LTalk.json
```

## Security

- Messages are encrypted end-to-end using Signal Protocol (X3DH + Double Ratchet)
- Local database is encrypted with SQLCipher; key stored in system keyring
- RLS policies enforce per-user data access on Supabase
- File attachments use signed URLs (not public)
- See [SECURITY.md](SECURITY.md) for reporting vulnerabilities

## License

GPL-3.0-or-later
