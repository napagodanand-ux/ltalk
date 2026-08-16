# LTalk Project Audit — Findings, Severity, and Remediation Roadmap

Status: **initially written 2026-08-16** · Verified by code reading, `pytest` run (6/113 failing at audit time), and `ruff` (301 errors at audit time).
**Phase 0 progress 2026-08-16 (same day)**: all Phase 0 items implemented; test suite now **113/113 passing**, ruff errors on touched files unchanged vs baseline (pre-existing debt only), mypy clean in touched daemon files.

This document is the canonical record of audit findings and the remediation plan. Each fix marks its item Status below. If implementation context is lost, re-read this document plus the referenced files/lines.

---

## 0. How to read this document

- **Severity**: `CRITICAL` (security/E2EE or hard runtime breakage) > `HIGH` (correctness/architecture) > `MEDIUM` (quality debt).
- **Status**: `OPEN` / `IN PROGRESS` / `DONE` / `DEFERRED`.
- Phases: **Phase 0** = surgical must-fix; **Phase 1** = architectural honesty; **Phase 2** = hardening; **Phase 3** = feature integrity.

---

## Part 1 — CRITICAL: Security & E2EE

### C1. Signal-Protocol "E2EE" is not real cryptography
- `ltalk_core/crypto/signal_manager.py` declares FFI symbols that do not exist in real libsignal (`signal_session_builder_create`, `signal_session_cipher_create`, `signal_session_cipher_encrypt`, `signal_session_cipher_decrypt_*`). Real API is `SignalSessionStore` callbacks + `signal_message_encrypt/decrypt`, `signal_process_prekey_bundle`, etc.
- `establish_session()` is a fake X3DH: `sha256(identity_key + signed_pre_key)[:32]` or `os.urandom(32)` (signal_manager.py:234-246).
- Fallback mode generates "public keys" with `os.urandom(33)` — not key pairs.
- `MessageEncryptor.encrypt_message(chat_id, ...)` encrypts **to the chat_id, not the peer user_id**; `_establish_new_session` queries `key_bundles` by chat_id → never matches → direct chats can't encrypt to the real peer, group chats broken.
- FFI buffers are never freed (memory leaks) (signal_manager.py:141-203).
- Native path demonstrably failed at audit: 6 tests failed with `undefined symbol: signal_session_builder_create` (the bundled `libsignal_ffi.so` did not export the declared symbols).
- `ltalk_core/crypto/libsignal_ffi.so` was an untracked, broken build artifact; **removed (Phase 0)** — library search now only uses system-installed libsignal, and fails closed when required.

**Fix (Phase 0, DONE)**: removed broken artifact; `.gitignore` now excludes `*.so`; dev/test fallback mode returns (`LTALK_ALLOW_FALLBACK_CRYPTO=1`) while production requires a real libsignal at system paths.
**Fix (Phase 2, DEFERRED)**: real libsignal integration — proper store callbacks, `signal_process_prekey_bundle`, real ratchet, per-peer sessions keyed by peer user_id, safety numbers, key rotation, pre-key replenishment.

### C2. File attachments are not encrypted; remote insert uses wrong column
- `MessageController.send_file` (ltalk_app/controllers/message.py:132-184) uploads **plaintext bytes** to Supabase Storage, hardcodes `image/png`, stores a 1-hour signed URL as `plaintext_content`, and inserts with `"content":` — a column that does not exist (messages has `encrypted_content` + `metadata`). Remote insert always fails; the plaintext URL is then queued as `encrypted_content`.

**Fix (Phase 0, DONE)**: correct insert columns (`encrypted_content` + `metadata` with `file_name`/`file_url`/`mime_type`) + metadata payload; enqueue stores the full send payload (message_id, sender_id). Data-flow fixed; a queue contract test added (`tests/test_db.py`).
**Fix (Phase 2, DEFERRED)**: client-side file encryption (AES-256-GCM per file, per-recipient key distribution via session keys — Signal attachment V2 pattern), private buckets, magic-byte validation server-side.

### C3. Database encryption silently downgrades to plaintext sqlite3
- `ltalk_core/db/connection.py:9-16`: missing `pysqlcipher3` → silent fallback to unencrypted `sqlite3`; JWTs, refresh tokens, identity private keys, and message plaintext sit in cleartext on disk.

**Fix (Phase 0, DONE)**: `Database.connect()` raises `RuntimeError` unless `pysqlcipher3` is available or `LTALK_ALLOW_PLAINTEXT_DB=1` is set (dev/test only — set by `tests/conftest.py`). Ship `pysqlcipher3` as mandatory dependency in production packaging.

### C4. Presence feature is broken twice
1. `"last_seen": "now()"` sent as a JSON string literal → PostgREST rejects it (presence.py:95, ipc_server.py:146).
2. Callers pre-prefix filters with `eq.` while `SupabaseDatabase` adds `eq.` again → `eq.eq.<uuid>` on every presence/profile query (presence.py:96, ipc_server.py:147, ltalkd/main.py:172).
3. `PresenceHeartbeat._get_user_id` opens a fresh `Database()`+keyring fetch per call (presence.py:66-81).

**Fix (Phase 0, DONE)**: filter normalization in `SupabaseDatabase._prepare_param/_build_filters` (bare values get `eq.`, operator-prefixed values like `eq.x`/`ilike.*y*` pass through — also fixes user search); presence sends `{"online": bool}` only; `last_seen` maintained by a server-side `BEFORE UPDATE OF online` trigger added to `supabase_schema.sql`; `PresenceHeartbeat` reuses the daemon's DB connection; daemon skips notifications for its own messages.

---

## Part 2 — CRITICAL: Architecture & runtime bugs

### A1. Nested event loops starve all async work in the GUI
- `ltalk_app/main.py:88-170`: `asyncio.run(_main_async())` creates loop #1; inside it a second `qasync.QEventLoop` runs `run_forever()`. Tasks created before the swap (realtime receive loop, disappearing-messages loop, timers) are scheduled on the blocked loop #1 → realtime events never delivered.

**Status: DONE** — single-loop pattern via `qasync.QEventLoop` + `asyncio.set_event_loop` + `loop.create_task(_bootstrap())`.

### A2. Realtime subscriptions are invalid; heartbeat never sent
- GUI subscribes to topic `realtime:public:messages:chat_id=eq.{id}` — not a Supabase topic (backend.py:600-604). Join silently fails → GUI never receives messages.
- Daemon subscribes unfiltered (realtime_listener.py:40-44) → global fan-in + per-message profile lookup.
- `_join_channel` puts `"topic"` inside the join payload config (realtime.py:191-205) — invalid Phoenix payload.
- Heartbeat task (`HEARTBEAT_INTERVAL` exists) is never started → server drops socket ~60s → reconnect churn.

**Status: DONE** — join payload no longer nests `topic` in config; `phx_heartbeat` task sent every `HEARTBEAT_INTERVAL` (tasks cancelled on stop/disconnect); GUI subscribes to the valid `realtime:public:messages` topic (RLS scopes delivery).

### A3. GUI↔daemon IPC is dead code and insecure where it exists
- `IpcClient` never used; IPC-dependent features no-op silently. `_handle_typing` is `pass`.
- `/tmp/ltalk-{uid}.sock`: no symlink check, no peer auth, unbounded frame size.
- `IpcProtocol.feed` grows buffer unboundedly; `deserialize` accepts arbitrary JSON.

**Status: DONE** — IPC hardened and wired: `IpcProtocol` enforces a 1 MiB frame cap (raises `ValueError` on overflow, connection dropped); `IpcServer` authenticates peers via `SO_PEERCRED` (fail-closed: only same-uid connections accepted); `_handle_typing` forwards to other connected GUI clients instead of `pass`; GUI `Backend` connects its `IpcClient` on startup (sends `GUI_OPENED`, handles `NEW_MESSAGE`/`SYNC_STATE` pushes) and the daemon broadcasts `NEW_MESSAGE` to the GUI on receipt; `MessageController.handle_incoming` dedups (same message can arrive via GUI realtime + daemon IPC). Socket hygiene: path unlinked before bind + `chmod 0600`; with peer creds the only residual vector is a same-uid DoS (pre-creating a directory at the socket path). `AUTH_TOKEN_REFRESH` IPC message removed — token rotation propagates via the shared `local_user` row instead (see S2).

### A4. Offline queue can never drain — messages silently lost
- `_drain_offline_queue` inserts `"content":` (no such column) and uses queue rowid as message id (backend.py:610-628).
- `QueueProcessor` inserts without `sender_id`/`created_at` (NOT NULL on server) (queue_processor.py:69-75).
- `MessageRepository.insert` uses `INSERT OR REPLACE` — overwrites edits/state.

**Fix (Phase 0, DONE)**: migration 002 adds `message_id` + `sender_id` to `offline_queue`; `enqueue()` is now `(chat_id, encrypted_content, message_type, message_id, sender_id, ...)` — full send payload is preserved (message id no longer diverges from the locally stored message); GUI drain and daemon `QueueProcessor` send the correct columns (`encrypted_content`/`metadata`, `sender_id`), mark sent by queue row id; migration v2 hack removed — append-only versioned migrations.
**Fix (Phase 2, DEFERRED)**: replace `INSERT OR REPLACE` with upsert preserving state; exponential backoff; explicit "not sent" UI feedback.

### A5. `_sync_data` N+1 storm and misleading previews
- Per-chat: chat + members + N×profile + 2×messages queries → hundreds of requests at login (backend.py:501-561).
- Direct-chat display name = `member_names[0]` — itself (no self-filter) (backend.py:521).
- Preview = `encrypted_content[:100]` — ciphertext stored into `plaintext_content`; search matches ciphertext.
- Server `created_at` TIMESTAMPTZ string vs local INTEGER column.

**Fix (Phase 0, DONE)**: sync now writes chat members locally (skipping self for direct chats) so the sidebar shows the correct peer name; removed dead display-name computation.
**Fix (Phase 1, DONE)**: server-side `chat_summaries` view (`security_invoker = true` so member-scoped RLS applies) returns chat + members JSON + epoch-second timestamps in **one query** — replaces the per-chat chat/members/profile storm (backend `_sync_data` now makes 2 queries + one per chat for recent messages; the N×profile+members lookups are gone). `to_epoch()` in `ltalk_core/timestamps.py` unifies server ISO/epoch values with the local INTEGER epoch columns (prevents ISO strings landing in `created_at`). Preview honesty: no more ciphertext previews — chat-list previews come from locally decrypted messages only.
**Fix (Phase 2, DEFERRED)**: decrypt previews client-side (needs C1).

### A6. Column-name mismatches across the stack
- `metadata` (server) vs `metadata_json` (local migration) vs `content` (bug, send_file/drain) — three keys, three call sites.

**Status: DONE (Phase 0)** — single wire-mapping in send/enqueue/drain/processor paths (`encrypted_content` + `metadata`), with queue contract tests in `tests/test_db.py`.

---

## Part 3 — HIGH: Security hardening

| ID | Issue | Fix (Phase) | Status |
|---|---|---|---|
| S1 | RLS: `message_status`/`calls` SELECT open to all authenticated users; missing `chats`/`message_status` DELETE policies; inserts don't check chat membership | Membership-scoped policies + delete policies (Phase 1) | DONE (Phase 1): `messages`/`message_status`/`calls` INSERT/UPDATE scoped to chat membership; delete policies added (`chats_delete` creator-or-admin, `chat_members_delete` self or creator/admin, `message_status_delete`, `calls_delete`); `chat_members_insert` creator/group-admin only (no self-join, needs `chats.created_by` — client sets it); static contract tests in `tests/test_schema.py` |
| S2 | JWT + refresh_token plaintext in local DB (only safe if C3 holds); daemon never refreshes expired tokens; realtime/presence die silently after expiry | Central TokenManager, refresh-on-401, daemon↔GUI refresh propagation (Phase 1) | DONE (Phase 1): `TokenManager` (`ltalk_core/supabase/token_manager.py`) refreshes proactively (~75% of lifetime, ≥60s grace, backoff on failure), persists rotated tokens to `local_user`, and runs in **both** GUI and daemon — propagation is implicit via the shared DB (daemon↔GUI `AUTH_TOKEN_REFRESH` IPC message removed). On rotation both processes reconnect Realtime so subscriptions never die on expiry. On-401 refresh for individual requests remains Phase 2 |
| S3 | Logs leak plaintext: `notification_sender.py:44` logs `message[:50]` to disk | Redact bodies; log ids/hashes only (Phase 2) | DEFERRED |
| S4 | `service_role_key` field in `SupabaseConfig` invites misuse | Remove from client; service-role ops → edge functions (Phase 1) | DONE (Phase 1): field removed from `SupabaseConfig` + docstring requires Edge Functions for service-role work; no service-role key in schema (`tests/test_schema.py` enforces) |
| S5 | Storage: buckets unguarded, content type trusted from client | Private buckets; server-side magic-byte validation (Phase 2) | DEFERRED |
| S6 | Identity keys: no fingerprint/safety-number verification; no MITM detection | Safety numbers UI (Phase 2/3) | DEFERRED |

---

## Part 4 — Debug code, dead code, quality debt

### Debug / leftover code
| Location | Item | Status |
|---|---|---|
| signal_manager.py FFI block | Stub FFI against nonexistent symbols | Phase 2 rework (C1) |
| `ltalk_core/crypto/libsignal_ffi.so` | Broken untracked binary **removed**; `*.so` added to `.gitignore` | DONE |
| ipc_server._handle_typing | `pass` placeholder | DONE (A3): forwards to other GUI clients |
| notification_sender close_* | no-op stubs | Phase 3 (real notification ids/actions) |
| `os.system("ltalk &")` (tray) | shell-out anti-pattern | DONE (Phase 1): `subprocess.Popen([...], start_new_session=True)` |
| ltalk_app/ipc_client.py | entire unused file | DONE (A3): wired into `Backend` (GUI_OPENED + NEW_MESSAGE/SYNC_STATE pushes) |
| media_keys.py `MediaKeyHandler` | unused class | DONE (Phase 1): deleted; `GlobalHotkeyHandler` retained |
| Sidebar.qml:300 | `onTriggered: {} // TODO` | Phase 3 |
| ChatView.qml call buttons | "not yet implemented" placeholder | Phase 3 (calls signaling) |
| VoiceRecorder.qml | waveform placeholder | Phase 3 |
| `last_seen: "now()"` | prototyping leftover | DONE (C4) |

### Quality debt
- ruff: 301 errors at audit (83 UP045, 77 N802, 35 E501, 30 E402, 29 F401). — Phase 2
- mypy strict only on `ltalk_core/ ltalkd/`; `ltalk_app/` excluded in CI. — Phase 2
- Tests: 107 pass / 6 fail at audit (all crypto-native). **Phase 0: 113/113 green.** No tests for realtime/RLS/migrations upgrade path. — Phase 2
- CI: no submodule checkout, no libsignal build, no sqlcipher wheel tests. — Phase 2
- Supabase creds read at import time, no validation; empty-string config allowed. — Phase 2

---

## Part 5 — Remediation roadmap

### Phase 0 — stop the bleeding (surgical; completed)
- [x] Write this document.
- [x] Remove broken `libsignal_ffi.so` artifact; gitignore `*.so`.
- [x] A1: single qasync loop in `ltalk_app/main.py`.
- [x] A2: realtime join payload + heartbeat task + GUI subscription fix.
- [x] C4: filter normalization (`eq.` handling) + presence payload fix + `last_seen` trigger in schema.
- [x] A4/A6: offline-queue migration 002 + correct drain/send/queue fields.
- [x] C3: fail closed without SQLCipher (env override for dev/tests).
- [x] A5 (partial): direct-chat display-name self-filter in `_sync_data`.
- [x] Verify: full `pytest` green (113/113), ruff on touched files unchanged vs baseline, mypy clean in touched daemon files.

### Phase 1 — make the architecture honest (completed)
- [x] A3: IPC wired — `IpcProtocol` frame caps (1 MiB), `IpcServer` `SO_PEERCRED` peer auth (fail-closed), typing forwarded to other clients, GUI connects via `IpcClient` on startup, daemon broadcasts `NEW_MESSAGE` to GUI, `handle_incoming` dedup.
- [x] A5: `chat_summaries` view (security_invoker, epoch timestamps, members JSON) replaces the N+1 sync; `to_epoch` timestamp adapter; no ciphertext previews.
- [x] S1: RLS lockdown — membership scoping on messages/message_status/calls, `chats_delete`/`chat_members_delete`/`message_status_delete`/`calls_delete`, `chat_members_insert` creator/group-admin only (added `chats.created_by` + client sets it); static schema contract tests (`tests/test_schema.py`).
- [x] S2: `TokenManager` proactive refresh (~75% lifetime, grace, backoff) in GUI + daemon; rotated tokens persisted to `local_user` (cross-process propagation via shared DB); realtime reconnects on rotation; `AUTH_TOKEN_REFRESH` IPC message removed. Per-request refresh-on-401 deferred to Phase 2.
- [x] S4: `service_role_key` removed from `SupabaseConfig`; edge-function path documented; no service-role in schema.
- [x] Dead code: `MediaKeyHandler` deleted; `IpcClient` wired (A3); tray `os.system` → `subprocess.Popen`.
- [x] Verify: 143/143 pytest green; ruff diff on touched files clean vs baseline; mypy diff on `ltalk_core/ ltalkd/` clean vs baseline.

### Phase 2 — production hardening
- C1: real libsignal (store callbacks, X3DH, ratchet, safety numbers, key rotation).
- C2: attachment envelope encryption (attachment-v2 pattern).
- A4: upsert semantics + backoff + "not sent" UI.
- S3: log redaction + rotation; structured JSON logs.
- Ruff to zero; strict mypy incl. `ltalk_app`; CI: submodule checkout, libsignal build, sqlcipher wheels.
- Contract tests for wire rows (local ↔ server), realtime protocol, RLS.
- Graceful daemon stop paths (Ctrl+C already signals SIGTERM/SIGINT → `stop()`; verify window-close/quit flows); remove stray `FinalizerAdapter`-style hacks if any remain.

### Phase 3 — feature integrity
- Typing indicators via proper realtime broadcast channel (current `typing:*` topic is not a Supabase topic).
- Read receipts via `message_status` batching; calls signaling via edge functions (function exists, nothing calls it).
- Statuses: replace `sha256(status_id)` key derivation with real shared-secret envelopes.
- Disappearing messages: server-enforced (currently client-cosmetic).
- Voice recorder, call buttons, sidebar TODO.

---

## Appendix — Files most in need of attention

| File | Why |
|---|---|
| ltalk_core/crypto/signal_manager.py | Fake FFI/crypto (C1) |
| ltalk_core/crypto/encrypt.py | `sha256(status_id)` key derivation (Phase 3); chat-id-as-recipient (C1) |
| ltalk_app/backend.py | Loop bug (A1) done; N+1 sync (A5), queue drain (A4) fixed; realtime subscribe (A2) fixed |
| ltalk_app/controllers/message.py | File insert columns (C2) fixed; send paths |
| ltalk_core/supabase/realtime.py | Join payload + heartbeat (A2) fixed |
| ltalk_core/supabase/database.py | Filter normalization (C4) fixed |
| ltalk_core/db/connection.py | Fail-closed SQLCipher (C3) fixed |
| ltalk_core/db/migrations.py | Migration v2 hack removed; append-only scheme (A4) |
| supabase_schema.sql | RLS gaps (S1), `last_seen` trigger (C4) |