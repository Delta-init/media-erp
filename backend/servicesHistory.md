# Backend Services History

> Every service class and method ever created goes here.
> Read this before adding any new service method — it may already exist.
> Format: **Feature · File · Class · Method · Signature · Purpose**

---

## How to use

1. Before creating a service method, search this file for the class name + method name.
2. If it already exists, reuse it — do NOT create a duplicate.
3. After creating a new method, add it here immediately.

---

## Services

### `register_user(email, password, name, db)` (feature 1.9)
- **File:** `app/services/auth_service.py`
- **Signature:** `async def register_user(email: str, password: str, name: str, db: AsyncIOMotorDatabase) -> dict`
- **Purpose:** Hashes password, inserts new user. Raises `ValueError` if email taken.
- **Collections:** `users`

### `authenticate_user(email, password, db)` (feature 1.9)
- **File:** `app/services/auth_service.py`
- **Signature:** `async def authenticate_user(email: str, password: str, db: AsyncIOMotorDatabase) -> dict`
- **Purpose:** Verifies bcrypt password, checks `is_active`. Raises `ValueError` on any failure (generic — prevents email enumeration).
- **Collections:** `users`

### `hash_password(plain)` / `verify_password(plain, hashed)` (feature 1.9)
- **File:** `app/services/auth_service.py`
- **Purpose:** bcrypt helpers via passlib `CryptContext`

---

## Utility functions (1.7)

### `create_access_token(user_id: str) -> str`
- **File:** `app/utils/jwt.py`
- **Purpose:** Signs a 15-min access JWT with `sub=user_id`, `type=access`

### `create_refresh_token(user_id: str) -> str`
- **File:** `app/utils/jwt.py`
- **Purpose:** Signs a 7-day refresh JWT with `sub=user_id`, `type=refresh`

### `decode_access_token(token: str) -> dict`
- **File:** `app/utils/jwt.py`
- **Purpose:** Validates and decodes an access JWT; raises `JWTError` on failure

### `decode_refresh_token(token: str) -> dict` (feature 1.10)
- **File:** `app/utils/jwt.py`
- **Purpose:** Validates and decodes a refresh JWT; raises `JWTError` if type != "refresh"

### `encrypt(plaintext: str) -> str`
- **File:** `app/utils/encryption.py`
- **Purpose:** AES-256-GCM encrypt → base64(nonce+ciphertext); used for OAuth tokens

### `decrypt(token: str) -> str`
- **File:** `app/utils/encryption.py`
- **Purpose:** Inverse of `encrypt()`

---

### `create_connector(user_id, platform, name, sync_frequency, db)` (feature 2.1)
- **File:** `app/services/connector_service.py`
- **Signature:** `async def create_connector(user_id, platform, name, sync_frequency, db) -> dict`
- **Purpose:** Inserts a new connector document with status=disconnected. Returns the inserted doc with `_id`.
- **Collections:** `connectors`

### `get_connector(connector_id, user_id, db)` (feature 2.1)
- **File:** `app/services/connector_service.py`
- **Purpose:** Fetches connector by ObjectId, scoped to `user_id`. Returns None for invalid ID or ownership mismatch.

### `list_connectors(user_id, db)` (feature 2.1)
- **File:** `app/services/connector_service.py`
- **Purpose:** Returns all connectors for a user sorted by `created_at desc` (max 200).

### `update_connector(connector_id, user_id, updates, db)` (feature 2.1)
- **File:** `app/services/connector_service.py`
- **Purpose:** `find_one_and_update` with `$set`, auto-stamps `updated_at`. Returns updated doc or None.

### `delete_connector(connector_id, user_id, db)` (feature 2.1)
- **File:** `app/services/connector_service.py`
- **Purpose:** Deletes connector scoped to user. Returns True if deleted, False if not found.

### `save_tokens(connector_id, user_id, access_token, refresh_token, expires_at, platform_account_id, db)` (feature 2.1)
- **File:** `app/services/connector_service.py`
- **Purpose:** Encrypts tokens via `utils/encryption.encrypt()`, sets `status=connected`, persists via `update_connector`.

### `get_decrypted_tokens(connector)` (feature 2.1)
- **File:** `app/services/connector_service.py`
- **Signature:** `def get_decrypted_tokens(connector: dict) -> dict` (sync — no DB call)
- **Purpose:** Decrypts `encrypted_access_token` / `encrypted_refresh_token` fields using AES-256-GCM.

---

### `update_profile(user_id, updates, db)` (feature 7.1)
- **File:** `app/services/auth_service.py`
- **Signature:** `async def update_profile(user_id: str, updates: dict, db) -> dict`
- **Purpose:** Updates `name` and/or `email`. Checks email uniqueness against other accounts (409 if taken).
- **Collections:** `users`

### `update_password(user_id, current_password, new_password, db)` (feature 7.1)
- **File:** `app/services/auth_service.py`
- **Signature:** `async def update_password(user_id, current_password, new_password, db) -> None`
- **Purpose:** Verifies current password, rejects reuse of same password, bumps `token_version` to signal invalidation.
- **Collections:** `users`

---

### `sync_connector(connector_id)` (feature 3.3 — Celery task)
- **File:** `app/tasks/sync_tasks.py`
- **Signature:** `@app.task def sync_connector(connector_id: str) -> dict`
- **Purpose:** Full sync cycle: update status→syncing, call platform `fetch_data`, upsert marketing_data, emit notification.
- **Collections:** `connectors`, `marketing_data`, `notifications`

### `upsert_marketing_data(user_id, connector_id, platform, records, db)` (feature 3.3)
- **File:** `app/services/sync_service.py`
- **Purpose:** Bulk-upserts normalized marketing data records using the unique compound index.
- **Collections:** `marketing_data`

---

### `create_notification_sync(user_id, type, title, message, metadata, client)` (feature 7.2)
- **File:** `app/services/notification_service.py`
- **Signature:** `def create_notification_sync(user_id, notification_type, title, message, metadata, client) -> None`
- **Purpose:** Synchronous (PyMongo) notification insert — used from Celery tasks.
- **Collections:** `notifications`

### `list_notifications(user_id, limit, unread_only, db)` (feature 7.2)
- **File:** `app/services/notification_service.py`
- **Signature:** `async def list_notifications(user_id, limit, unread_only, db) -> dict`
- **Purpose:** Returns `{ items: [...], unread_count: N }`.
- **Collections:** `notifications`

### `mark_read(notification_id, user_id, db)` (feature 7.2)
- **File:** `app/services/notification_service.py`
- **Purpose:** Sets `read=True` on one notification. Returns `False` if not found or wrong user.
- **Collections:** `notifications`

### `mark_all_read(user_id, db)` (feature 7.2)
- **File:** `app/services/notification_service.py`
- **Purpose:** Sets `read=True` on all unread notifications for user.
- **Collections:** `notifications`

---

### `generate_pipeline(question, user_id)` (feature 6.1)
- **File:** `app/services/ai_service.py`
- **Signature:** `async def generate_pipeline(question: str, user_id: str) -> list[dict]`
- **Purpose:** Calls Gemini 2.5 Flash with schema + rules to generate a MongoDB aggregation pipeline. Validates and sanitises output; force-injects user_id match stage.
- **Model:** `gemini-2.5-flash`

### `execute_pipeline(pipeline, db)` (feature 6.2)
- **File:** `app/services/ai_service.py`
- **Signature:** `async def execute_pipeline(pipeline: list[dict], db) -> list[dict]`
- **Purpose:** Runs the validated pipeline against `marketing_data`. Returns JSON-safe results (max 100 rows).
- **Collections:** `marketing_data`

### `explain_result(question, result)` (feature 6.2)
- **File:** `app/services/ai_service.py`
- **Signature:** `async def explain_result(question: str, result: list[dict]) -> str`
- **Purpose:** Second Gemini call — explains the result in 2-3 plain-English sentences for a non-technical audience.

### `run_ai_query(question, user_id, db)` (feature 6.2)
- **File:** `app/services/ai_service.py`
- **Signature:** `async def run_ai_query(question, user_id, db) -> dict`
- **Purpose:** Orchestrates generate → execute → explain → persist to `ai_queries`.
- **Collections:** `marketing_data`, `ai_queries`

---

### Template entry

```
### ServiceClass.method_name
- **Feature:** X.Y
- **File:** `app/services/service_file.py`
- **Signature:** `async def method_name(self, param: Type, db: AsyncIOMotorDatabase) -> ReturnType`
- **Purpose:** One-line description of what this method does
- **Collections touched:** collection_name
```

---

## projects router — leader queue + reedit return-to-origin (2026-07-15)
- `GET /projects/leader/queue` now returns a **`reedit`** list (status=reedit tasks in the leader's teams). Previously missing entirely → the frontend Reedit tab was always empty. Added to both the empty-state and normal responses.
- **Approve & route** now stamps the routed copy with `routed_by_id`, `routed_by_name`, `origin_team_id` (the routing leader's team).
- **`PUT /projects/{id}` → status=reedit:** if the task carries `origin_team_id` (i.e. it was routed here), it is returned home — `team_id` set back to `origin_team_id`, `assigned_to` cleared, `former_team_name` set to the returning team. Only a leader/admin of the current team may return it (`workflow.can_approve`). The reedit notification then fires to the origin team's leaders.
- Guarded the re-assignment notification so it only fires when a *new* assignee is set (skips the misleading "assigned" DM when clearing the assignee).

## project history recording restored + cross-team aggregation (2026-07-15)
- **Regression fixed:** the per-transition history append from commit d895a43 was lost in merge 782271a, so status changes recorded NO history. Restored in `edit_task` — every status change and assignment now pushes a history entry, each tagged with `team_id` + `team_name` (the team the action happened in; uses the pre-update team so a reedit-return is attributed to the team that raised it).
- **Chain linkage:** Approve & Route now (a) pushes a `routed` entry to the source task, (b) stamps the copy with `root_task_id` + `parent_task_id`, and (c) seeds the copy with a `received` history entry ("Received from <team>").
- **Aggregation:** new `project_service.get_chain_history(db, doc)` gathers the root + all copies sharing `root_task_id`, merges their histories chronologically (tagging each with its team), and derives a `team_flow` summary (ordered team stops with outcome). `GET /projects/{id}` now returns the merged `history` + `team_flow`.
- Verified end-to-end via API: a video→content(reedit)→video→content(approved) run produced the exact team_flow and a 15-entry merged history.

## media router — pre-signed direct-to-R2 uploads (2026-07-15)
- `POST /media/presign` (auth): issues short-lived pre-signed PUT URLs so the browser uploads file bytes straight to R2 (bypassing the backend → up to 1 GB/file). Body `{files:[{filename,content_type,size}], prefix?}`; returns `{upload_url, method, headers, public_url, key, ...}` per file. Enforces the 1 GB cap.
- `storage.presign_put()` generates the signed URL (R2) or a local-disk PUT fallback (`PUT /media/local-blob/{key}`) when R2 is disabled — identical frontend flow either way.
- `storage.ensure_bucket_cors()` + `scripts/set_r2_cors.py` configure the R2 bucket CORS (GET/PUT/HEAD for the app origins) so browser PUTs from localhost/prod succeed. Run once per bucket.
- Legacy multipart endpoints (`/media/upload`, `/media/upload-attachments`) remain but are no longer used by the frontend.

## Timezone: mediaERP now runs entirely on IST (2026-07-15)
- **Policy** (`app/utils/timezone.py`): storage stays **UTC instants**; every wall-clock decision is **IST** (Asia/Kolkata, UTC+05:30). Fixed +05:30 offset used (IST has no DST) so no `tzdata` dependency for the helpers. Helpers: `IST`, `now_ist`, `to_ist`, `to_utc`, `today_ist`, `ist_day_start_utc/…_end_utc`, `ist_period_start_utc`, `utc_iso`.
- **BUG FIXED — email schedules:** `_compute_next_send` treated `send_time` ("09:00") as **UTC**, so schedules fired at 14:30 IST. Now computed in IST wall-clock and stored as the UTC instant. `scripts/migrate_schedules_to_ist.py` recomputes legacy rows (dry-run by default; `--apply` to write).
- **BUG FIXED — naive serialization (widespread):** ~38 sites across routers/services emitted `dt.isoformat()` on Motor's timezone-**naive** datetimes, dropping the offset — JS then parsed them as *local* time (e.g. email logs showed 14:39 instead of 20:09 IST). All now go through `utc_iso()`. Calendar `date(...).isoformat()` deliberately untouched.
- **Task date filters:** `list_tasks` today/this_week/this_month/this_year now use **IST day boundaries** (also fixes a latent `this_week` crash at month boundaries).
- **Celery:** `timezone="Asia/Kolkata"`, `enable_utc=False` — beat crontabs are IST wall-clock (anomaly scan 02:00 IST). Added `tzdata` to requirements.txt (beat needs the IANA db; Windows/slim containers lack it).
- `group_chat_service` now imports the shared `IST` constant.

## Leader Desk — leader self-assign fixed (2026-07-15)
- **BUG:** a leader could not meaningfully assign work to themselves. `GET /projects/leader/queue`'s `incoming` matched `{"$or": [assigned_to in ["",None], assigned_to == uid]}`, so a task the leader assigned **to themselves** stayed in the "Assign Work" (to-distribute) queue forever — the card never moved, so it looked like the action failed. (The write itself always succeeded: `can_assign_to_others` already allows a team leader, and the API returned 200.)
- **FIX:** `incoming` now matches **unassigned pending work only**. Once assigned to anyone — including the leader themselves — the task leaves the distribute queue and appears on the assignee's board. The old `assigned_to == uid` clause existed so leaders could see routed tasks auto-assigned to them, but routed copies now arrive unassigned (see the reedit/routing change), so it was vestigial and actively harmful.

## Tasks disappearing — root causes fixed (2026-07-18)
- **BUG (main cause): `workflow.bump_other_started` bumped the whole TEAM.** The
  "one started task per person" rule fell back to `team_id` when a task had no
  assignee — so starting ONE unassigned task moved *every other started task in
  that team* to Break. Coordinators create unassigned tasks, so work kept
  vanishing from the Started column with no message. Now scoped strictly to the
  assignee; unassigned tasks bump nobody. Reproduced before (`A=break`) and
  verified after (two people both stay Started; same person still bumps).
- **`list_tasks` truncation is no longer silent.** Cap raised 500 → `TASK_LIST_LIMIT`
  (2000) and the function now returns `(tasks, total)`. `GET /projects` reports
  `meta: {total, returned, truncated}` and a "Showing X of Y tasks" message.
  Results are newest-first, so a cap always drops the OLDEST work.
- `success_response()` gained an optional `meta` dict (omitted unless supplied,
  so existing clients are unaffected).
- **Task creation now validated server-side** (POST /projects): title, team_id,
  due_date and assigned_to are all required, and the assignee must be a leader or
  member of the selected team. Routed copies still bypass this — they're created
  via `insert_one`, intentionally unassigned.

**Environment note:** ports 8000 and 3000 were both occupied by *other* projects
(a `bun --watch src/index.ts` server, and `Delta/lms/client`). mediaERP was being
tested against a foreign API. `bun --watch` respawns itself — kill the parent.

## Real pagination for tasks (2026-07-18)
- `GET /projects` accepts `page` (>=1) and `limit` (0-500), mirroring the
  existing `/users` convention. **`limit=0` (default) preserves the legacy
  behaviour** — everything up to `TASK_LIST_LIMIT` — so existing callers are
  untouched.
- `list_tasks()` applies `.skip()/.limit()` and always returns the true `total`.
- Pagination rides in `meta`, NOT in `data`: `{total, returned, page, limit,
  pages, has_more, truncated}`. `data` stays a plain array so nothing breaks.
- Verified lossless: walking 9 pages of 10 returned exactly 86 unique tasks with
  zero duplicates; per-column paging (`status=pending`, 6 pages of 5) returned
  all 28 with no gaps.

## Frontend same-origin API proxy (2026-07-19) — no backend change
Purely a frontend routing change (see frontend/componentsHistory.md). Noted here
because it affects how the backend is reached: in production, ALL browser
traffic (REST + WebSocket) now arrives via the frontend's Next.js server acting
as a reverse proxy, rather than directly from browsers. CORS on the backend can
eventually be tightened to just the frontend origin once this is confirmed live,
since direct cross-origin browser calls are no longer the intended path.
