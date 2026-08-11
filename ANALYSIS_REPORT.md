# LTalk — Complete Project Analysis Report

**Project**: LTalk v1.0.0 — Secure Messaging for Linux
**Stack**: Python 3.11+, PySide6/QML, Supabase (Postgres+Auth+Realtime+Storage), SQLCipher, Signal Protocol, D-Bus, systemd
**Architecture**: GUI process (`ltalk_app`) ↔ Unix socket IPC ↔ Background daemon (`ltalkd`) ↔ Supabase cloud

---

## Table of Contents

- [Part 1: The Best](#part-1-the-best)
- [Part 2: The Good](#part-2-the-good)
- [Part 3: The Bad](#part-3-the-bad)
- [Part 4: The Ugly](#part-4-the-ugly)
- [Part 5: Improvements](#part-5-improvements)
- [Part 6: Fixes](#part-6-fixes-specific-code-changes)
- [Part 7: Summary Metrics](#part-7-summary-metrics)

---

## Part 1: The Best

### 1.1 — Architectural Vision

The GUI/daemon split is the right call for a messaging app. The daemon maintains persistent Supabase Realtime connections, presence heartbeats, system tray with unread badges, D-Bus notifications with inline reply, and an offline message queue — all independent of whether the GUI window is open. This is how mature Linux desktop apps (Signal, Telegram) work.

### 1.2 — IPC Protocol Design

`ltalk_core/ipc/protocol.py` is well-engineered:

- Newline-delimited JSON framing (simple, debuggable)
- Typed message enum with clear directionality (GUI→Daemon, Daemon→GUI)
- `IpcProtocol.feed()` correctly handles partial reads and buffering
- Factory methods (`IpcMessage.new_message()`, `.send_message()`, etc.) keep call sites clean
- `request_id` field enables future request-response correlation

### 1.3 — Encrypted Local Database

SQLCipher with keyring-based key management (`ltalk_core/crypto/keyring.py`) is the correct approach. The fallback chain (secretstorage → python-keyring → file with `0o600`) is sensible. WAL mode, foreign keys, and proper schema versioning with migrations show database literacy.

### 1.4 — Offline Queue with Retry

`ltalk_core/db/queue.py` implements a proper offline message queue: enqueue on failure, dequeue on reconnect, increment retry count, purge stale entries after 7 days. The daemon's `QueueProcessor` runs this on a 30-second loop. This is production-grade pattern.

### 1.5 — Realtime WebSocket Client

`ltalk_core/supabase/realtime.py` is a custom Phoenix Channels client with:

- Exponential backoff reconnection (1s → 30s max)
- Heartbeat support (30s interval)
- Channel join/leave lifecycle
- Pending ack tracking with `asyncio.Event`
- Clean disconnect with transport-level close

### 1.6 — QML UI Quality

The QML layer is polished:

- Maroon-themed design system with dark/light mode via `Theme` singleton
- Chat bubbles with tail canvas, appear animations (`scale` + `opacity` with `Easing.OutBack`)
- Responsive layout (narrow mode < 768px with sidebar toggle)
- Drag-and-drop file sending
- Context menus on chats and messages
- Typing indicator with bouncing dots animation
- Status/stories carousel with progress bar
- Call window with pulse ring animations
- Reusable components: `MaroonButton`, `MaroonTextField`, `SearchBar`, `Avatar`, `Toast`, `ModalDialog`

### 1.7 — Type System

Consistent use of `from __future__ import annotations`, proper `Optional`, `Union`, return type annotations, and `dataclass` domain types with `to_dict()`/`from_dict()` serialization throughout the core library.

### 1.8 — Test Coverage Breadth

6 test files covering: SessionCache (LRU behavior), SignalManager (key generation, encrypt/decrypt), Database (connect, migrate, CRUD), MessageRepository (insert, search, delete, star, status workflow), ChatRepository (unread, mute, pin), OfflineQueue (enqueue, dequeue, retry), IPC protocol (serialize, deserialize, framing), and Supabase client config.

---

## Part 2: The Good

### 2.1 — Supabase Integration Without SDK

Hand-rolled PostgREST, Auth, Realtime, Storage, and Edge Function clients instead of the heavy `supabase-py` SDK. This gives full control over HTTP behavior, reduces dependency size, and avoids SDK quirks. The `SupabaseDatabase.rpc()` method for calling Postgres functions is a nice touch.

### 2.2 — D-Bus Desktop Integration

`ltalkd/notification_sender.py` properly uses the Freedesktop Notifications spec via `dasbus` with:

- Inline reply action
- Call notifications with accept/decline (critical urgency)
- Avatar image hints
- Proper notification ID tracking for replacement

### 2.3 — System Tray with Dynamic Badge

`ltalkd/tray_manager.py` renders a maroon circle with "LT" text and a red badge counter. Context menu provides quick actions. The badge dynamically updates with unread count.

### 2.4 — Key Management

Three-tier key storage:

1. Identity key pair in SQLCipher
2. Pre-keys and signed pre-keys in SQLCipher
3. Session records in SQLCipher with LRU memory cache
4. Key bundle upload to Supabase for X3DH

### 2.5 — systemd Integration

`scripts/install-daemon.sh` creates a proper user-level systemd service with `Restart=always`, `RestartSec=5`, and `Wants=network-online.target`. Clean and correct.

### 2.6 — Packaging Infrastructure

- Flatpak manifest with correct D-Bus permissions (notifications, secrets, media keys, global shortcuts, tray)
- AppImage build via PyInstaller
- Dev setup script that checks all system dependencies

### 2.7 — Message Feature Completeness

For a v1.0, the feature set is impressive: text, image, document, voice messages, reply, forward (UI placeholder), star, delete for me/everyone, edit (UI placeholder), disappearing messages, message status (sent/delivered/read), typing indicators, search.

### 2.8 — Status/Stories System

Complete status/stories feature: create, view, expiry (24h), privacy settings, view tracking, status viewer with progress animation.

---

## Part 3: The Bad

### 3.1 — CRITICAL: `.env` Contains Real Supabase Credentials

**File**: `.env:1-2`

The `.env` file contains a real Supabase URL and anon key:

```
SUPABASE_URL=https://qfmjxzokihsvytgkpgha.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `.gitignore` excludes `.env` but the file is present in the project directory. If this was ever committed (even in a branch), the credentials are compromised. The anon key has a JWT with `iat: 1786259706` (2026) and `exp: 2101835706` (2036) — a 10-year expiry is extremely unusual and suspicious.

**Fix**: Rotate the Supabase anon key immediately. Add `.env` to `.gitignore` (already done). Ensure it was never committed via `git log --all -- .env`.

### 3.2 — CRITICAL: RLS Policies Are Completely Broken

**File**: `supabase_schema.sql:153-168`

```sql
-- chats: ANY authenticated user can SELECT, INSERT, UPDATE any chat
CREATE POLICY "chats_select" ON public.chats FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "chats_insert" ON public.chats FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "chats_update" ON public.chats FOR UPDATE USING (auth.role() = 'authenticated');

-- messages: ANY authenticated user can SELECT any message
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (auth.role() = 'authenticated');
```

This means:

- Any authenticated user can read **every chat** in the system
- Any authenticated user can read **every message** from every user
- Any authenticated user can create chats as anyone
- Any authenticated user can update any message

The comment "The app handles access control via the client" is a **fundamental security anti-pattern**. RLS must be the security boundary. A malicious user can bypass any client-side checks by calling the PostgREST API directly.

**Fix**: Replace with per-user policies:

```sql
CREATE POLICY "chats_select" ON public.chats FOR SELECT
  USING (id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid()));
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = auth.uid()));
```

### 3.3 — CRITICAL: Status RLS References Non-Existent Column

**File**: `supabase_schema.sql:175-180`

```sql
CREATE POLICY "statuses_select" ON public.statuses FOR SELECT USING (
    auth.uid() = user_id
    OR user_id IN (
        SELECT user_id FROM contacts WHERE added_by = auth.uid()
    )
);
```

The `contacts` table has columns `(user_id, contact_id, contact_name_override, created_at)` — there is no `added_by` column. This policy will **fail at runtime** with a Postgres error, potentially making all statuses invisible or causing 500 errors.

### 3.4 — CRITICAL: Fallback Encryption Is Not Encryption

**File**: `ltalk_core/crypto/signal_manager.py:260-263`

```python
if self._use_fallback:
    import hashlib
    key = hashlib.sha256(session_record).digest()
    return bytes(p ^ key[i % len(key)] for i, p in enumerate(plaintext))
```

This is a repeating-key XOR cipher. It provides **zero security**:

- The key is derived from the session record, which is stored in plaintext in the DB
- XOR with a repeating key is trivially broken via frequency analysis
- The same key encrypts every message in a session (no forward secrecy)

**File**: `ltalk_core/crypto/encrypt.py:140-148` — `encrypt_for_status()` uses the same XOR pattern with `SHA256(status_id)` as the key. Anyone with the status_id can decrypt.

The fallback silently degrades security with only a log warning. Users have no way to know their messages aren't actually encrypted.

### 3.5 — CRITICAL: Native X3DH Is Also Broken

**File**: `ltalk_core/crypto/signal_manager.py:221-247`

Even when libsignal IS loaded, the `establish_session()` method falls back to `SHA256(identity_key + signed_pre_key)` when the native path fails. The native path itself is incomplete — it creates a builder with `b"peer"` as the address (not a real user ID), doesn't construct a proper `PreKeyBundle`, and derives `SHA256(our_pub + their_pub + their_signed_pre_key)` which is not X3DH.

The `encrypt()` and `decrypt()` native paths also have issues — the session cipher is created with a hardcoded `b"peer"` address and doesn't properly initialize the session state.

### 3.6 — CRITICAL: `backend.py` Runtime Crashes

**File**: `ltalk_app/backend.py`

Multiple methods will crash at runtime due to type mismatches:

**Line 223-229** — `_sync_data()` calls `self._chat_repo.insert({...})` passing a **dict** to `ChatRepository.insert()` which expects a `Chat` dataclass:

```python
self._chat_repo.insert({
    "id": chat_id,
    "display_name": display_name,
    ...
})
```

`ChatRepository.insert()` accesses `chat.id`, `chat.is_group`, etc. as attributes — this will raise `AttributeError`.

**Line 247-256** — Same issue with `self._message_repo.insert({...})` — passes a dict where `Message` dataclass is expected.

**Line 267-268** — `_refresh_chat_list()`:

- `self._chat_repo.get_all(self._current_user_id)` — `get_all()` takes `include_archived: bool`, not a user_id
- `self._chat_repo.get_unread_count(chat.id, self._current_user_id)` — method doesn't exist (it's `get_total_unread()` with no args)
- `last_msg.content` — `Message` has `plaintext_content`, not `content`

**Lines 420-430** — `_load_messages_async()`:

- `msg.content` → should be `msg.plaintext_content`
- `msg.sender_name` → doesn't exist on `Message`
- `msg.status.value` → `status` is a string in the dict, not a `MessageStatus` enum
- `msg.is_deleted_for_me` → should be `msg.deleted_for_me`
- `msg.is_edited` → should be `msg.edited_at is not None`

These mean: **data sync, chat list refresh, and message loading are all broken**. The app likely only works with cached data or crashes on first load.

### 3.7 — CRITICAL: `presence.py` Creates New DB Connection Every 60 Seconds

**File**: `ltalkd/presence.py:65-77`

```python
async def _get_user_id(self) -> str | None:
    from ltalk_core.db.connection import Database
    db = Database()
    db.connect()
    row = db.fetchone("SELECT id FROM local_user LIMIT 1")
    db.close()
    if row:
        return row["id"]
```

This opens a new SQLCipher connection, runs a query, and closes it **every 60 seconds**. SQLCipher connections are expensive to establish (key derivation). On error, the connection may leak. The user_id should be cached or passed from the daemon.

### 3.8 — CRITICAL: `GlobalHotkeyHandler.stop()` Is a No-Op

**File**: `ltalkd/media_keys.py:98-100`

```python
def stop(self) -> None:
    pass
```

The `start()` method connects D-Bus signals but `stop()` does nothing. The signal handler reference (`_portal_signal`) is never disconnected, causing potential callbacks after the daemon shuts down.

### 3.9 — HIGH: `TrayManager` Creates QApplication in Daemon

**File**: `ltalkd/tray_manager.py:30-31`

```python
app = QApplication.instance()
if app is None:
    app = QApplication(sys.argv)
```

The daemon is a headless background service. If `$DISPLAY` or `$WAYLAND_DISPLAY` is not set (e.g., running via systemd without a session), `QApplication()` will crash. No guard for headless environments.

### 3.10 — HIGH: Token Refresh Race Condition

**File**: `ltalk_app/backend.py:138-151`

If the JWT is expired, the code refreshes it. But if two coroutines both detect expiry simultaneously (e.g., `initialize()` and an incoming message handler), both will attempt to refresh, potentially invalidating the refresh token.

### 3.11 — HIGH: No Input Validation on User Search

**File**: `ltalk_app/backend.py:732-736`

```python
results = await self._database.select(
    "profiles",
    filters={"display_name": f"ilike.*{query}*"},
    limit=20,
)
```

The `query` parameter from the user is interpolated directly into a PostgREST filter without sanitization. A crafted query could manipulate the filter syntax. Also, the `ilike` pattern is not properly escaped — `%` and `_` in the query would act as wildcards.

### 3.12 — HIGH: File Upload Stores Files as Public URLs

**File**: `ltalk_app/backend.py:596`

```python
file_url = await self._storage.get_public_url(bucket, storage_path)
```

Chat file attachments are stored in a "public" bucket, meaning anyone with the URL can access them. For an encrypted messaging app, files should be in a private bucket with signed URLs.

### 3.13 — HIGH: `MessageListModel` Role Name Mismatch

**File**: `ltalk_app/models/message_list_model.py:64-77`

The model uses `msg.get("id", "")` for `MessageId` but the QML `MessageBubble.qml:225` accesses `model.messageId`. Qt model roles are accessed via the role names returned by `roleNames()`, which returns `b"messageId"`. This works. BUT the data dict uses `"id"` while the QML accesses `model.messageId` — this is correct because `roleNames()` maps `MessageId` → `b"messageId"` and `data()` returns `msg.get("id")`. However, in `MessageBubble.qml:231`, it accesses `model.content` which maps to `msg.get("plaintext_content")`. This works but is confusing because the role is named `Content` but the underlying data key is `plaintext_content`.

More critically, `ChatView.qml:217` passes `model.content` to `MessageBubble.content`, which then displays it. But `model.content` comes from `msg.get("plaintext_content")` — if the message was received encrypted and decryption failed, this would show `"[Encrypted message]"` or `None`.

### 3.14 — MEDIUM: `backend.py` God Object

At 1036 lines, `Backend` handles: auth (login, register, logout, token refresh), chat CRUD (create, delete, open), message CRUD (send, reply, delete, edit), file uploads (files, avatars), contact management (search, add, block/unblock), settings (profile update), typing indicators, realtime subscription, offline queue draining, disappearing messages cleanup, and key bundle upload.

This should be split into at least: `AuthController`, `ChatController`, `MessageController`, `ContactController`, `FileController`, `SettingsController`.

### 3.15 — MEDIUM: Inconsistent `except Exception` Error Handling

The codebase has **80+ bare `except Exception`** handlers in the project code alone. Most just log and continue, masking real errors:

```python
except Exception as e:
    logger.warning("Failed to send message: %s", e)
```

No distinction between transient errors (network timeout) and permanent errors (auth failure, schema mismatch). Retrying auth failures will never succeed.

### 3.16 — MEDIUM: `check_email` Is Dead Code

**File**: `ltalk_app/backend.py:391-394`

```python
@Slot(str, result=bool)
def check_email(self, email: str) -> bool:
    return False  # Cannot check auth.users from client; handled by sign_up errors
```

Always returns `False`. The QML never calls it. Should be removed.

### 3.17 — MEDIUM: Missing `__init__.py` Exports

All `__init__.py` files are single-line docstrings:

```python
"""LTalk Core — Shared library for GUI and Daemon."""
```

No re-exports, making imports verbose:

```python
from ltalk_core.crypto.encrypt import MessageEncryptor
from ltalk_core.crypto.key_store import KeyStore
from ltalk_core.crypto.session_cache import SessionCache
from ltalk_core.crypto.signal_manager import SignalManager
```

Should re-export the public API.

### 3.18 — MEDIUM: No README.md

`pyproject.toml:9` references `readme = "README.md"` but no README exists. The PyPI page and GitHub landing page would show nothing.

---

## Part 4: The Ugly

### 4.1 — `libsignal/` Is a Full Rust Crate Checkout (~200+ Files)

The entire libsignal Rust crate (with attest, zkcredential, svrb subcrates, fuzz targets, test data, protobuf definitions) is checked into the project root. This should be:

- A git submodule
- A pre-built `.so` downloaded during setup
- An external dependency built by the packaging system

This bloats the repo and makes `git clone` unnecessarily large.

### 4.2 — Flatpak Manifest Has `sha256: FIXME`

**File**: `packaging/flatpak/org.ltalk.LTalk.json:41,62,72`

Three source entries have `sha256: FIXME` — the manifest is non-functional. A Flatpak build would fail.

### 4.3 — `build-appimage.sh` Uses Global `pip3 install`

**File**: `scripts/build-appimage.sh:13`

```bash
pip3 install -r requirements.txt
pip3 install pyinstaller
```

This installs into the system Python, potentially breaking other packages. Should use a venv.

### 4.4 — `build-appimage.sh` References Non-Existent `README.md`

**File**: `scripts/build-appimage.sh:59`

```bash
cp README.md AppDir/usr/share/doc/
```

No README exists.

### 4.5 — Test Mocking Is Ad-Hoc

**File**: `tests/test_crypto.py:72-78`

```python
class MockDb:
    def execute(self, query, params=()):
        pass
    def commit(self):
        pass
    def fetchone(self, query, params=()):
        return None
```

Inline mock classes instead of `pytest-mock` or `unittest.mock.MagicMock`. The mock doesn't implement `fetchall`, `begin_transaction`, `table_exists`, etc. — tests only pass because the tested code paths don't call those methods.

### 4.6 — `RippleEffect.qml` References Undefined `radius`

**File**: `ltalk_app/resources/qml/components/RippleEffect.qml:21`

```qml
ctx.arc(root.startX, root.startY, radius, 0, Math.PI * 2)
```

`radius` is a property of `rippleCanvas` (line 25), but it's referenced without `rippleCanvas.radius` — in QML, the unqualified reference resolves to the innermost scope, which is the Canvas's `onPaint` context. This works but is fragile.

### 4.7 — `MessageBubble.qml:166` — Incorrect Image Detection Logic

**File**: `ltalk_app/resources/qml/MessageBubble.qml:166`

```qml
visible: !content || !content.toString().indexOf("http") === 0 || !content.toString().match(/\.(png|jpg|jpeg|gif|webp)$/i)
```

Operator precedence bug: `!content.toString().indexOf("http")` evaluates as `!(content.toString().indexOf("http"))` — `indexOf` returns `0` for "http://..." which is falsy, so `!0` is `true`. This accidentally works but is logically wrong. The intent was `content.toString().indexOf("http") !== 0`.

### 4.8 — `ContactsPage.qml:97-104` — Property Scoping Bug

**File**: `ltalk_app/resources/qml/ContactsPage.qml:97`

```qml
property string contactUserId: modelData.user_id || ""
```

This property is defined inside a delegate, but accessed as `root.contactUserId` on line 104:

```qml
if (root.contactUserId) {
```

`root` refers to the `ContactsPage` Rectangle, not the delegate. This will always be empty. Should be just `contactUserId` or the delegate should have its own id.

### 4.9 — `DetailPanel.qml:176` — Empty Block User

**File**: `ltalk_app/resources/qml/DetailPanel.qml:176`

```qml
onClicked: backend.blockUser("")
```

Passes an empty string as the user ID to block. This will either crash or block nobody.

### 4.10 — `SettingsScreen.qml:92` — Local File Path as Avatar URL

**File**: `ltalk_app/resources/qml/SettingsScreen.qml:92`

```qml
root.currentAvatarUrl = filePath
```

After uploading the avatar, the local file path is set as the avatar URL. The `Avatar.qml` component then tries to load this as an image source. While it might work locally, it's not the remote URL returned by the upload. The backend should emit the remote URL.

### 4.11 — `MainLayout.qml:58` — Escape Key Accesses Non-Existent Property

**File**: `ltalk_app/resources/qml/MainLayout.qml:58`

```qml
else if (layout.detailPanel) layout.detailPanel.visible = false
```

`layout.detailPanel` is not a property — it's an `id` reference to the `DetailPanel` component. This should be `detailPanel.visible = false`. Also, `detailPanel.visible` is being set but `detailPanel` has `Layout.fillHeight: true` — toggling `visible` on a layout child doesn't properly animate or resize.

### 4.12 — `VoiceRecorder.qml` — No Actual Recording

**File**: `ltalk_app/resources/qml/VoiceRecorder.qml:13-25`

The `VoiceRecorder` component simulates recording with a timer but never actually captures audio. `recordingComplete("")` always emits an empty path. The voice button in `MessageInput.qml` triggers this fake recorder.

### 4.13 — `CallWindow.qml` and `MiniCallWindow.qml` — Placeholder Only

These components exist with UI (pulse animations, accept/decline buttons) but no actual WebRTC or call logic. The `backend.errorOccurred("Voice calls coming soon")` in `ChatView.qml:143` confirms this.

### 4.14 — No CI/CD Pipeline

No `.github/workflows/`, no `Makefile`, no `tox.ini`, no `pre-commit-config.yaml`. No automated linting, type checking, or test execution.

### 4.15 — `ChatListModel.update_chats()` Sorts Incorrectly

**File**: `ltalk_app/models/chat_list_model.py:79-83`

```python
self._chats = sorted(
    chats,
    key=lambda c: (c.get("is_pinned", False), c.get("last_message_at", 0)),
    reverse=True,
)
```

`reverse=True` sorts pinned chats first (correct) but also sorts by `last_message_at` descending (newest first). However, `is_pinned` is a bool — `True > False` so with `reverse=True`, pinned chats come first. But if two chats are both pinned, they sort by `last_message_at` descending. This is correct. BUT the `_all_chats` list is not sorted, so `search()` results come back in insertion order.

---

## Part 5: Improvements

### 5.1 — Security

| Priority | Issue | Fix |
|----------|-------|-----|
| P0 | RLS policies allow any user to read all data | Rewrite with `chat_members` join checks |
| P0 | Status RLS references `added_by` (non-existent) | Fix column reference to `contact_id` |
| P0 | XOR fallback provides no security | Hard-fail without libsignal or use AES-GCM |
| P0 | .env has real credentials | Rotate key, ensure never committed |
| P1 | Files stored in public bucket | Use private bucket + signed URLs |
| P1 | JWT stored in plaintext DB | Encrypt with DB key or use short-lived tokens |
| P1 | No token refresh locking | Add asyncio Lock for refresh |
| P2 | No rate limiting on auth endpoints | Implement client-side throttle |

### 5.2 — Correctness

| Priority | Issue | Fix |
|----------|-------|-----|
| P0 | `backend.py` passes dicts to repos expecting dataclasses | Construct proper `Chat`/`Message` objects |
| P0 | `_refresh_chat_list` calls non-existent methods | Fix method names and signatures |
| P0 | `_load_messages_async` accesses wrong attributes | Use correct `Message` field names |
| P0 | `DetailPanel` blocks empty user ID | Pass actual user ID from chat members |
| P1 | `GlobalHotkeyHandler.stop()` is no-op | Disconnect D-Bus signal |
| P1 | `ContactsPage` property scoping bug | Use delegate-local reference |
| P1 | `MessageBubble` image detection precedence | Add parentheses: `content.toString().indexOf("http") !== 0` |

### 5.3 — Architecture

| Priority | Issue | Fix |
|----------|-------|-----|
| P1 | `backend.py` is 1036 lines | Split into controllers |
| P1 | No dependency injection | Create a service registry |
| P2 | Inline imports in methods | Move to module-level imports |
| P2 | Missing `__init__.py` exports | Re-export public API |
| P2 | `libsignal/` vendored in repo | Make it a submodule or external build |

### 5.4 — DevEx

| Priority | Issue | Fix |
|----------|-------|-----|
| P1 | No README | Write one with setup, architecture, screenshots |
| P1 | No CI | Add GitHub Actions with ruff + mypy + pytest |
| P1 | Ad-hoc test mocking | Use `pytest-mock` fixtures |
| P2 | No Makefile | Add common targets |
| P2 | No pre-commit hooks | Add ruff + mypy hooks |
| P2 | Flatpak sha256: FIXME | Fill in real hashes |

### 5.5 — QML Polish

| Priority | Issue | Fix |
|----------|-------|-----|
| P1 | Voice recorder is fake | Integrate QtMultimedia AudioRecorder |
| P1 | Calls are placeholders | Implement WebRTC or remove UI |
| P2 | `ContactsPage` delegate scoping | Fix property access |
| P2 | `DetailPanel` block user empty | Pass real user ID |
| P2 | Settings avatar sets local path | Use remote URL from backend |
| P2 | `Escape` key `detailPanel.visible` | Use proper reference |

---

## Part 6: Fixes (Specific Code Changes)

### Fix 1: `backend.py:_sync_data` — Dict vs Dataclass

```python
# WRONG (line 223):
self._chat_repo.insert({...})

# RIGHT:
from ltalk_core.types.chat import Chat
chat = Chat(id=chat_id, is_group=chat.get("is_group", False), ...)
self._chat_repo.insert(chat)
```

### Fix 2: `supabase_schema.sql` — Fix `added_by` Reference

```sql
-- WRONG (line 178):
SELECT user_id FROM contacts WHERE added_by = auth.uid()

-- RIGHT:
SELECT contact_id FROM contacts WHERE user_id = auth.uid()
```

### Fix 3: `MessageBubble.qml:166` — Fix Operator Precedence

```qml
// WRONG:
visible: !content || !content.toString().indexOf("http") === 0 || ...

// RIGHT:
visible: !content || content.toString().indexOf("http") !== 0 || ...
```

### Fix 4: `ContactsPage.qml:104` — Fix Property Reference

```qml
// WRONG:
if (root.contactUserId) {

// RIGHT:
if (contactUserId) {
```

### Fix 5: `DetailPanel.qml:176` — Pass Real User ID

```qml
// WRONG:
onClicked: backend.blockUser("")

// RIGHT (needs actual user_id from chat members):
onClicked: backend.blockUser(chatMemberUserId)
```

### Fix 6: `GlobalHotkeyHandler.stop()` — Implement Cleanup

```python
def stop(self) -> None:
    if hasattr(self, "_portal_signal"):
        try:
            self._portal_signal.disconnect()
        except Exception:
            pass
```

### Fix 7: `presence.py` — Cache User ID

```python
async def _get_user_id(self) -> str | None:
    if hasattr(self, "_cached_user_id"):
        return self._cached_user_id
    # ... fetch and cache
```

---

## Part 7: Summary Metrics

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture** | 8/10 | Clean GUI/daemon split, good IPC, proper offline queue |
| **Security Design** | 3/10 | Good intent (Signal, SQLCipher), catastrophic execution (RLS, XOR fallback, public files) |
| **Code Correctness** | 4/10 | Core library is solid, `backend.py` has multiple runtime crashes |
| **Code Quality** | 6/10 | Good typing and models, but God Object and bare exceptions |
| **Testing** | 5/10 | Good breadth, but doesn't catch backend.py attribute errors |
| **UI/UX** | 7/10 | Polished QML, responsive layout, nice animations, but some broken interactions |
| **DevOps** | 4/10 | AppImage + Flatpak + systemd exist, but no CI, broken Flatpak hashes |
| **Documentation** | 1/10 | No README, minimal inline docs |
| **Production Readiness** | 2/10 | Critical security and correctness issues must be fixed first |

**Overall**: LTalk is an **ambitious, well-architected project** with a clear vision and strong foundations in its core library. However, it has **critical security vulnerabilities** (RLS policies, fallback crypto) and **multiple runtime crashes** in the main backend that prevent it from being usable. The QML UI is polished and the daemon architecture is mature. With focused work on the P0 fixes listed above, this could become a solid secure messaging platform.
