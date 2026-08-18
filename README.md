# LTalk

![Build](https://github.com/napagodanand-ux/ltalk/actions/workflows/build.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey)

> **Secure, end-to-end encrypted desktop messaging.**

**LTalk** is a production-grade desktop messenger built with **Electron + React + TypeScript + Supabase**.
It delivers true end-to-end encryption, real-time messaging, presence, media sharing,
message editing, reactions, replies, and automatic updates for **Windows** and **Linux**.
The same client also runs as a web app (which updates live, so it is not version-pinned).

---

## ✨ Features

- **End-to-end encryption (E2EE)** for 1:1 conversations — `ECDH P-256` key exchange + `HKDF` + `AES-256-GCM`.
- **Real-time messaging** — instant delivery across all open conversations via Supabase Realtime.
- **Presence & typing** — online / away / offline status and live typing indicators.
- **Media sharing** — images and files with upload progress and error reporting.
- **Rich messages** — edit, reactions (emoji), replies, delete-for-me and delete-for-everyone.
- **Cross-platform notifications** — native Windows toasts + Linux notifications, with an in-app fallback.
- **Automatic updates** — the desktop app self-updates from GitHub Releases via `electron-updater`.
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

- 1:1 messages are encrypted **client-side**; the server only ever stores ciphertext.
- Group conversations are not encrypted (by design) — a trade-off between E2EE and multi-party key management.
- Supabase Row Level Security (RLS) enforces per-user data isolation on every table.
- Private keys never leave the device and are stored in the OS credential store.

## 📦 Installation

Download the latest installer for your platform from the
[Releases](https://github.com/napagodanand-ux/ltalk/releases) page:

- **Windows** — `LTalk-Setup-*.exe` (NSIS installer)
- **Linux** — `LTalk-*.AppImage` or `ltalk_*.deb`

The app checks for updates automatically and prompts you when a new version is available
(manual check is also available in **Settings → Updates**).

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

[MIT](LICENSE) © LTalk

---

# LTalk — راهنمای فارسی

> **پیام‌رسان امن دسکتاپ با رمزنگاری سرتاسر (End-to-End).**

**LTalk** یک پیام‌رسان دسکتاپ در سطح تولید است که با **الکترون، ری‌اکت، تایپ‌اسکریپت و سوپابیس**
ساخته شده است. این برنامه رمزنگاری واقعی سرتاسر، پیام‌رسانی بلادرنگ، حضور آنلاین،
اشتراک رسانه، ویرایش پیام، واکنش‌ها، پاسخ‌ها و به‌روزرسانی خودکار برای **ویندوز** و **لینوکس**
را فراهم می‌کند.

## ویژگی‌ها

- **رمزنگاری سرتاسر (E2EE)** برای گفت‌وگوهای دونفره — تبادل کلید `ECDH P-256` + `HKDF` + `AES-256-GCM`.
- **پیام‌رسانی بلادرنگ** — دریافت آنی در تمام گفت‌وگوهای باز از طریق Supabase Realtime.
- **حضور و در حال تایپ** — وضعیت آنلاین / دور / آفلاین و نشانگر تایپ زنده.
- **اشتراک رسانه** — تصاویر و فایل‌ها با نمایش پیشرفت آپلود و خطا.
- **پیام‌های غنی** — ویرایش، واکنش (ایموجی)، پاسخ، حذف برای من و حذف برای همه.
- **اعلان‌های چندسکویی** — اعلان‌های بومی ویندوز و لینوکس به همراه حالت جایگزین درون‌برنامه‌ای.
- **به‌روزرسانی خودکار** — برنامه دسکتاپ از طریق GitHub Releases و `electron-updater` خود را به‌روز می‌کند.
- **تم** — روشن / تاریک.

## امنیت

- پیام‌های دونفره در **سوی کلاینت** رمزنگاری می‌شوند و سرور تنها متن رمزشده را ذخیره می‌کند.
- گفت‌وگوهای گروهی رمزنگاری نمی‌شوند (طبق طراحی) — تا توازن میان E2EE و مدیریت کلید چندنفره حفظ شود.
- سطح دسترسی ردیفی (RLS) در سوپابیس، انزوای داده‌ها را برای هر کاربر در تمام جداول اعمال می‌کند.
- کلیدهای خصوصی هرگز دستگاه را ترک نمی‌کنند و در فروشگاه گواهینامه‌های سیستم‌عامل ذخیره می‌شوند.

## نصب

جدیدترین نصب‌کننده مربوط به سیستم‌عامل خود را از صفحه
[انتشارها](https://github.com/napagodanand-ux/ltalk/releases) دانلود کنید:

- **ویندوز** — `LTalk-Setup-*.exe`
- **لینوکس** — `LTalk-*.AppImage` یا `ltalk_*.deb`

برنامه به‌طور خودکار به‌روزرسانی را بررسی می‌کند و در صورت وجود نسخه جدید به شما هشدار می‌دهد
(بررسی دستی نیز در **تنظیمات ← به‌روزرسانی‌ها** موجود است).

## توسعه

پیش‌نیازها: **Node.js 20+** و **npm**.

```bash
npm install
cp .env.example .env   # مقادیر VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY را تنظیم کنید
npm run dev
```

## ساخت و انتشار

```bash
npm run dist            # ساخت محلی (بدون امضا) برای سیستم‌عامل فعلی
npm run release:patch   # افزایش نسخه + برچسب git + انتشار خودکار توسط CI
```

با هل کردن برچسب `v*`، اکشن گیت‌هاب نسخه‌های ویندوز و لینوکس را می‌سازد و منتشر می‌کند.
برنامه‌های نصب‌شده نسخه جدید را تشخیص داده و به‌روز می‌شوند.

## امضای کد (ویندوز)

برای توزیع **امضا‌شده**، دو مقدار را به‌عنوان **مخفی مخزن** (Secrets) اضافه کنید:

| مخفی | مقدار |
| --- | --- |
| `CSC_LINK` | Base64 گواهی `.pfx` (یا نشانی آن) |
| `CSC_KEY_PASSWORD` | گذرواژه گواهی |

در صورت وجود این مقادیر، `electron-builder` در جریان CI برنامه ویندوز را امضا می‌کند.
در غیر این صورت ساخت بدون امضا خواهد بود و ممکن است SmartScreen هشدار دهد.
هیچ مخفی‌ای در مخزن کامیت نمی‌شود.

## مجوز

[MIT](LICENSE) © LTalk
