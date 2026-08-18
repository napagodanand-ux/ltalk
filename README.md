# LTalk

![Build](https://github.com/napagodanand-ux/ltalk/actions/workflows/build.yml/badge.svg)
![License](https://img.shields.io/badge/license-Proprietary-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey)

> **Secure, end-to-end encrypted desktop messaging.**

**LTalk** is a production-grade desktop messenger built with **Electron + React + TypeScript + Supabase**.
It delivers true end-to-end encryption, real-time messaging, presence, media sharing,
message editing, reactions, replies, and automatic updates for **Windows** and **Linux**.
The same client also runs as a web app (which updates live, so it is not version-pinned).

---

## ✨ Features

- **End-to-end encryption (E2EE)** — 1:1 chats use `ECDH P-256` + `HKDF` + `AES-256-GCM`; group chats use a per-group symmetric `AES-256-GCM` key sealed to every member with their public key, so the server only ever stores ciphertext.
- **Real-time messaging** — instant delivery across all open conversations via Supabase Realtime, with read receipts.
- **Presence & typing** — online / away / offline (a force-killed session shows offline after a short timeout) and live typing indicators.
- **Media & voice** — images and files with upload progress/error reporting, plus voice messages with in-app playback.
- **Rich messages** — edit, emoji reactions, replies, emoji picker, delete-for-me (per-account and idempotent) and delete-for-everyone, plus in-app message search (Ctrl+F).
- **Group chats** — create groups from your friends with full E2EE and admin controls (rename, add/remove members, delete group); the creator is the group admin. Removing a member rotates the group key and re-encrypts history so a removed member can never read past or future messages.
- **Friend-request gating** — you can only message a user once a friend request has been sent **and** accepted by both sides. Both the UI and server-side RLS enforce this, so a chat cannot be started until the request is accepted.
- **Multi-device E2EE** — your encryption key is backed up (encrypted with your account password) and automatically restored when you sign in on another device, so your conversations stay readable everywhere. A failed key restore never overwrites your registered key, and a successful password restore self-heals the registered public key so existing conversations become readable again.
- **Offline support** — a non-blocking banner appears when the connection drops; local content stays readable and everything re-syncs on reconnect.
- **Automatic updates** — a launch splash checks for updates; optional updates can be skipped (the very next release then becomes required — a skip-cascade), while forced updates install immediately from GitHub Releases via `electron-updater`.
- **Cross-platform notifications** — native Windows toasts + Linux notifications, with an in-app fallback.
- **Themes** — light / dark.

## 🧱 Tech Stack

| Layer      | Technology                                        |
| ---------- | ------------------------------------------------- |
| Shell      | Electron 43                                       |
| UI         | React 18 + TypeScript + Tailwind CSS + Radix UI   |
| Backend    | Supabase (PostgreSQL + Realtime + Storage)        |
| Crypto     | Web Crypto (ECDH P-256, AES-256-GCM)              |
| Packaging  | electron-builder + electron-updater               |
| CI/CD      | GitHub Actions                                    |

## 🔐 Security

- All messages (1:1 and group) are encrypted **client-side**; the server only ever stores ciphertext.
- Group keys are generated locally and sealed to each member with their public key; a member who leaves or is removed can no longer decrypt new messages.
- Supabase Row Level Security (RLS) enforces per-user data isolation on every table, and group administration (rename/delete/manage members) is restricted to the group's creator (admin).
- Private keys never leave the device and are stored in the OS credential store; a password-encrypted backup enables multi-device access without ever exposing the raw key.

## 💻 Requirements

### General
- **Internet connection** — LTalk is a client for a hosted Supabase backend; realtime messaging, presence, media storage, and updates all require network access.
- **Account** — sign up inside the app. End users do **not** need to set up or host any server.
- **Free to use** — free for personal, non-commercial use under the LTalk Free License; the full source is on GitHub.

### Windows
- **OS:** Windows 10 or Windows 11, **64-bit (x86_64)**.
- **Disk:** ~600 MB free (Electron apps are large, plus cache and downloaded media).
- **Privileges:** a standard user account is enough — the installer is per-user and does **not** require administrator rights.
- **Code signing:** published builds are currently unsigned until a certificate is added, so Windows SmartScreen may warn on first launch. Click **More info → Run anyway**, or install a signed build (see `docs/SIGNING.md`).

### Linux
- **Architecture:** 64-bit **x86_64**.
- **Distributions:** any current desktop distro with a recent `glibc` — e.g. **Ubuntu 20.04+**, **Debian 11+**, **Linux Mint 20+**, **Fedora 35+**, **Arch Linux** (rolling).
- **AppImage:** needs **FUSE 2** (`libfuse2`). If you see `dlopen(): error loading libfuse.so.2`, install it (`sudo apt install libfuse2`), run with `APPIMAGE_EXTRACT_AND_RUN=1 ./LTalk-*.AppImage`, or use the `.deb`.
- **Debian / Ubuntu & derivatives:** install the `.deb` with `sudo dpkg -i ltalk_*.deb` (no FUSE required).
- **Arch / Manjaro:** use the AppImage (with FUSE 2) or build from source; there is no official `pacman` package yet.
- **System libraries:** a normal desktop environment is assumed. Electron needs `libnss3`, `libgbm`, `libatk-1.0`, `libxkbcommon`, `libxcomposite`, `libxdamage`, `libxrandr`, `libpango`, `libasound2`, etc., which are present on standard desktop installs but may be missing on minimal/headless systems.

### Hardware (all platforms)
- **CPU:** 64-bit processor (x86_64). ARM64 is not part of the current builds.
- **RAM:** 4 GB recommended (2 GB minimum — Electron/Chromium is memory-hungry).
- **Storage:** ~600 MB–1 GB free for the app, cache, and downloaded media.
- **Display:** any standard resolution.
- **Network:** broadband recommended for media and realtime; the app auto-updates over HTTPS.

## 📦 Installation

Download the latest installer for your platform from the
[Releases](https://github.com/napagodanand-ux/ltalk/releases) page:

- **Windows** — `LTalk-Setup-*.exe` (NSIS installer)
- **Linux** — `LTalk-*.AppImage` or `ltalk_*.deb`

> **Linux / AppImage:** AppImages require FUSE 2 (`libfuse.so.2`). If you see
> `dlopen(): error loading libfuse.so.2`, either install it
> (`sudo apt install libfuse2` on Debian/Ubuntu, `sudo dnf install fuse` on Fedora,
> `sudo pacman -S fuse2` on Arch) or run with
> `APPIMAGE_EXTRACT_AND_RUN=1 ./LTalk-*.AppImage`. Prefer the `.deb`
> (`sudo dpkg -i ltalk_*.deb && ltalk`) for a FUSE-free install.

The app checks for updates automatically on launch (shown in a brief splash) and prompts you when a new version is available.
Updates are normally **optional** — you can skip one and keep using the current version; however, skipping a release makes the **next** release
**required** (a skip-cascade), and a server-defined minimum version can also force an update.
A manual check is always available in **Settings → Updates**.

## 🛠 Development

Prerequisites: **Node.js 20+** and **npm**.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then edit .env and set:
#      VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
#      VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY

# 3. Run in development
npm run dev

# 4. Quality gates
npm run lint
npm run typecheck
npm run test
```

The dev server runs at `http://localhost:5173`; the Electron shell loads it automatically.

## 🚀 Building & Releasing

```bash
# Local, unsigned build for the current OS
npm run dist

# Cut a new version and publish it (triggers CI which builds + publishes)
npm run release:patch   # 1.0.0 -> 1.0.1
npm run release:minor   # 1.0.0 -> 1.1.0
npm run release:major   # 1.0.0 -> 2.0.0
```

`release:*` bumps `package.json`, creates a `vX.Y.Z` git tag, and pushes it.
The GitHub Action then builds Windows + Linux, runs the quality gates, and publishes a
GitHub Release that the in-app updater consumes.

## 🔄 Automatic Updates

- The desktop app embeds its version and checks `latest.yml` from the GitHub Releases feed.
- On launch a splash shows the update check; optional updates offer **Update now** / **Skip**, while forced (skipped-cascade or below the server minimum) updates must be installed.
- Pushing a new `v*` tag produces a new release; installed apps detect it and update.
- **Web** is served live and therefore has no version pin and no auto-update prompt.

## ✍️ Code Signing (Windows)

To ship **signed** Windows binaries (recommended for distribution), add two
**repository secrets** (Settings → Secrets and variables → Actions):

| Secret            | Value                                                          |
| ----------------- | ------------------------------------------------------------- |
| `CSC_LINK`        | Base64 of your code-signing `.pfx` (or a URL to it)           |
| `CSC_KEY_PASSWORD`| The password for that certificate                             |

When these secrets are present, `electron-builder` signs the Windows build automatically
during CI (with SHA-256 and a trusted timestamp). **Without them, builds remain unsigned**
and Windows SmartScreen may warn on install. No secrets are committed to the repository.

> Linux artifacts (AppImage / deb) are not Authenticode-signed; this is standard and not required.

## 📁 Project Structure

```
src/
  main/        Electron main process, IPC, updater, tray, window
  preload/     Context-bridge API exposed to the renderer
  renderer/    React UI (chat, contacts, settings, stores, lib)
  shared/      Types and constants shared across processes
supabase/      Database schema (single source of truth)
.github/       CI workflows (release build + publish)
```

## 📄 License

[LTalk Free License](LICENSE) © 2026 LTalk — free for personal use, not open source.
