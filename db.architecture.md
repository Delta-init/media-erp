# mediaERP — Database Architecture

> MongoDB data model: collections, fields, indexes, and relationships.
>
> See also: [PROJECT.md](PROJECT.md) · [api.doc.md](api.doc.md)

---

## 1. Overview

- **Engine:** MongoDB. Local dev → MongoDB Atlas in production.
- **Database name:** `settings.mongodb_db_name` (default `mediaerp`).
- **Drivers:**
  - **Motor** (async) for the FastAPI request path — `get_db()` in
    [backend/app/database.py](backend/app/database.py).
  - **PyMongo** (sync) for Celery tasks (Motor is async-only) — `get_sync_db()`.
- **Schema style:** schemaless documents. Some collections have a Pydantic model /
  doc-builder helper in `backend/app/models/`; many exist **implicitly** (created on first
  write by a service/router). "Model file" column below flags which is which.
- **Foreign keys:** stored as **stringified ObjectIds** (not DBRefs). A few IDs
  (`campaign_id`) key against *values* in `marketing_data`, not a document `_id`.
- **Index creation:** `create_indexes()` runs at app startup ([database.py](backend/app/database.py)).
  Collections not listed there rely on the default `_id` index only.

---

## 2. Collections at a glance

| Collection | Model file | Purpose |
|---|---|---|
| `users` | ✅ `models/user.py` | User accounts (auth, plan, RBAC role link) |
| `roles` | ✅ `models/role.py` (helpers) | RBAC roles: module × action permission matrix |
| `password_resets` | ⬚ implicit | OTP password-reset docs (TTL-expired) |
| `connectors` | ✅ `models/connector.py` | Per-user OAuth/API platform connections |
| `sync_runs` | ⬚ implicit | History of each connector sync execution |
| `marketing_data` | ✅ `models/marketing_data.py` | Unified daily campaign metrics |
| `reports` | ✅ `models/report.py` | Saved custom report definitions |
| `custom_metrics` | ⬚ implicit | User-defined formula metrics |
| `ai_queries` | ⬚ implicit | NL question → aggregation pipeline log |
| `notifications` | ✅ `models/notification.py` (helper) | Per-user in-app notifications |
| `notification_prefs` | ⬚ implicit | Per-user email notification preferences |
| `teams` | ⬚ implicit | Teams with embedded member list |
| `project_tasks` | ⬚ implicit | Kanban/workflow tasks (status machine, timing, history) |
| `board_statuses` | ⬚ implicit | Customizable kanban columns |
| `pipelines` | ✅ `models/pipeline.py` | Team-workflow routing graph |
| `media_tasks` | ⬚ implicit | Scheduled media/production tasks |
| `scheduled_posts` | ⬚ implicit | Scheduled social posts to publish |
| `messages` | ✅ `models/chat.py` (helper) | 1:1 chat messages |
| `social_messages` | ⬚ implicit | Inbound social DMs persisted from FB/IG webhooks |
| `rules` | ⬚ implicit | Automated alerting rules (threshold → action) |
| `rule_triggers` | ⬚ implicit | Log of rule firings |
| `email_schedules` | ⬚ implicit | Scheduled recurring email reports |
| `budget_goals` | ⬚ implicit | Per-campaign budget/pacing goals |
| `kpi_targets` | ⬚ implicit | Per-user metric KPI targets |
| `subscriptions` | ⬚ implicit | Stripe billing/plan state (1 per user) |
| `clients` | ⬚ implicit | Agency's managed clients |
| `whitelabel` | ⬚ implicit | Per-user white-label branding |
| `api_keys` | ⬚ implicit | Hashed programmatic API keys |
| `audit_logs` | ⬚ implicit | Audit trail of user actions |
| `email_settings` | ⬚ implicit | Global SMTP config (singleton `_id:"smtp"`) |

---

## 3. Fields by collection

> Every doc has `_id` (ObjectId). Timestamps are UTC `datetime` unless noted.

### `users`
`email` (unique), `hashed_password`, `name`, `role` (legacy `"user"`/`"admin"`),
`plan` (`free`/`pro`/`enterprise`), `is_active` (bool), `role_id` (→ `roles`),
`designation`, `status` (`active`/`inactive`), `avatar`, `whatsapp_phone`,
`created_at`, `updated_at`.

### `roles`
`role_name` (unique), `permissions` (dict: `module → {action: bool}`), `is_system_role` (bool), timestamps.
Modules: dashboard, connectors, reports, campaigns, projects, teams, ai, users, roles,
settings, schedule, rules, email_reports, social, chat, clients, pipeline. Actions: view,
create, edit, delete, export. Preset templates in [models/role.py](backend/app/models/role.py).

### `password_resets`
`user_id`, `email`, OTP fields, `expires_at` (**TTL**, auto-deleted). Legacy `token` field/index dropped.

### `connectors`
`user_id` (→ `users`), `platform` (enum in `PLATFORMS`), `name`,
`status` (`disconnected`/`connected`/`syncing`/`error`), `sync_frequency` (`hourly`/`daily`/`manual`),
`encrypted_access_token`, `encrypted_refresh_token`, `token_expires_at`, `last_synced_at`,
`error_message`, `platform_account_id`, `client_id` (→ `clients`, optional), timestamps.

### `sync_runs`
`connector_id` (→ `connectors`), `connector_name`, `platform`,
`status` (`running`/`success`/`error`), `started_at`, `finished_at`, `records_synced`, `error`.

### `marketing_data`
One doc = one campaign × one day × one platform.
`user_id`, `connector_id`, `platform`, `date` (ISO `"YYYY-MM-DD"` string), `account_id`,
`campaign_id`, `campaign_name`,
`metrics` `{impressions, clicks, spend, conversions, revenue, ctr, cpc, roas}` (some paths add `cpa`/`cpm`/`reach`),
`dimensions` `{device, country, currency}`, `synced_at`.
Derived metrics (ctr/cpc/roas) are precomputed on write for query performance.

### `reports`
`user_id`, `name`, `metrics` (list), `dimensions` (list), `filters` (dict),
`chart_type` (`line`/`bar`/`donut`/`table`), `share_token` (sparse), timestamps.

### `custom_metrics`
`user_id`, `name` (normalized), `label`, `formula`, `created_at`.

### `ai_queries`
`user_id`, `question`, `pipeline` (generated aggregation), `result`, `explanation`, `created_at`.

### `notifications`
`user_id` (**ObjectId**, not string), `type` (`sync_success`/`sync_error`/`info`/`task_*`…),
`title`, `message`, `read` (bool), `metadata` (dict — often `task_id`/`connector_id`), `created_at`.

### `notification_prefs`
`user_id`, `email_enabled` (bool), `email_types` (dict `type → bool`).

### `teams`
`name`, `description`, `color`, `created_by` (→ `users`),
`members` (list of `{user_id → users, role: leader|member, joined_at}`), timestamps.

### `project_tasks`
`title`, `description`, `priority`, `status`, `assigned_to` (→ `users`), `assigned_to_name`,
`due_date`, `team_id` (→ `teams`), `attachments` (list), `caption`, `created_by`,
`timing` `{intervals:[{started_at, ended_at}], total_seconds}`,
`history` (list of `{action, actor_id, actor_name, timestamp, from_status, to_status, note}`),
`pipeline_id` (→ `pipelines`), `pipeline_node_id`, `pipeline_parent_task_id` (self-ref), timestamps.
Status machine: `pending → started/reedit`, `started → break/pending_review`,
`pending_review → approved/reedit`.

### `board_statuses`
`key`, `label`, `color`, `position` (int), `is_default` (bool), timestamps.

### `pipelines`
`name`, `nodes` (list `{id, team_id → teams, position:{x,y}}`),
`edges` (list `{id, source, target, label}`), `created_by`, timestamps.
Nodes = teams; edges = "when approved in team A, advance to team B" (approver picks branch).

### `media_tasks`
`title`, `description`, `team_id` (→ `teams`), `assigned_to` (→ `users`), `start_date`,
`due_date`, `priority`, `status` (`scheduled → active`), `created_by`, timestamps.

### `scheduled_posts`
`user_id`, `connector_id` (→ `connectors`), `platform`, `caption`, `image_url`, `video_url`,
`scheduled_at`, `status` (`pending → processing → published/failed`), `published_at`, `error`,
`page_id`, `ig_user_id`, timestamps.

### `messages`
`from_user_id` (→ `users`), `to_user_id` (→ `users`), `content`, `read` (bool), `created_at`.

### `social_messages`
`mid` (unique sparse — platform message id), `platform`, `page_id`, `sender_id`,
`recipient_id`, `text`, `direction` (inbound), `connector_id` (→ `connectors`),
`user_id` (→ `users`), `raw`, `created_at`.

### `rules`
`user_id`, `name`, `platform`, `connector_id` (→ `connectors`), `campaign_id` (nullable),
`metric`, `operator` (`gt`/`lt`/`gte`/`lte`/`eq`), `threshold`,
`action` (`alert`/`pause_campaign`/`email`), `email_recipients` (list), `cooldown_minutes`,
`enabled`, `last_triggered_at`, `triggered_count`, timestamps.

### `rule_triggers`
`rule_id` (→ `rules`), `rule_name`, `user_id`, `campaign_id`, `campaign_name`, `platform`,
`metric`, `operator`, `threshold`, `actual_value`, `action_taken`, `action_result`, `triggered_at`.

### `email_schedules`
`user_id`, `name`, `frequency` (`daily`/`weekly`/`monthly`), `day_of_week`, `day_of_month`,
`send_time`, `recipients` (list), `platforms` (list), `date_range_days`, `enabled`,
`last_sent_at`, `next_send_at`, timestamps.

### `budget_goals`
`user_id`, `campaign_id`, `campaign_name`, `platform`, `connector_id`, `total_budget`,
`alert_threshold_pct`, `period` (`monthly`/`custom`), `period_start`, `period_end`, timestamps.

### `kpi_targets`
`user_id`, `metric`, `target_value`, `period`, `platform`, `label`, timestamps.

### `subscriptions`
`user_id` (unique), `plan`, `status`, `current_period_end`, `stripe_customer_id`,
`stripe_subscription_id`, `cancel_at_period_end` (bool).

### `clients`
`agency_user_id` (→ `users`), `name`, `company`, `email`, `phone`, `website`, `industry`,
`notes`, `color`, `status`, `invite_token`, `invited_at`, `accepted_at`, `connector_count`, timestamps.

### `whitelabel`
`user_id` (unique), `company_name`, `logo_url`, `primary_color`, `accent_color`,
`footer_text`, `report_title_prefix`, `hide_mediaerp_branding` (bool), `custom_font`, `updated_at`.

### `api_keys`
`user_id`, `name`, `key_hash` (unique), `key_prefix`, `scopes` (list, default `["read"]`),
`last_used_at`, `expires_at` (**TTL** sparse), `is_active`, `created_at`.

### `audit_logs`
`user_id`, `action`, `resource_type`, `resource_id`, `details` (dict), `ip_address`, `created_at`.

### `email_settings` (singleton, `_id: "smtp"`)
`host`, `port`, `username`, `password`, `from_email`, `from_name`, `use_tls`.

---

## 4. Indexes

Defined in `create_indexes()` ([backend/app/database.py](backend/app/database.py)):

| Collection | Index | Options |
|---|---|---|
| users | `email` | **unique** |
| users | `role_id` | |
| connectors | `(user_id, platform)` | |
| connectors | `user_id` | |
| marketing_data | `(user_id, platform, date, campaign_id)` | **unique** — `unique_data_point` |
| marketing_data | `(user_id, date ↓)` | |
| marketing_data | `(user_id, platform, date ↓)` | |
| marketing_data | `(connector_id, date ↓)` | |
| sync_runs | `(connector_id, started_at ↓)` | |
| reports | `(user_id, created_at ↓)` | |
| reports | `share_token` | sparse |
| ai_queries | `(user_id, created_at ↓)` | |
| notifications | `(user_id, created_at ↓)` | |
| notifications | `(user_id, read)` | |
| project_tasks | `created_at ↓` | |
| project_tasks | `status` | |
| roles | `role_name` | **unique** |
| messages | `(from_user_id, to_user_id, created_at ↓)` | |
| messages | `(to_user_id, read)` | |
| password_resets | `user_id` | |
| password_resets | `email` | |
| password_resets | `expires_at` | **TTL** `expireAfterSeconds=0` |
| rules | `(user_id, enabled)` | |
| rules | `(user_id, created_at ↓)` | |
| rule_triggers | `(user_id, triggered_at ↓)` | |
| rule_triggers | `rule_id` | |
| email_schedules | `(user_id, enabled)` | |
| email_schedules | `next_send_at` | |
| subscriptions | `user_id` | **unique** |
| subscriptions | `stripe_customer_id` | |
| clients | `(agency_user_id, status)` | |
| clients | `(agency_user_id, created_at ↓)` | |
| clients | `invite_token` | |
| whitelabel | `user_id` | **unique** |
| social_messages | `mid` | **unique**, sparse |
| social_messages | `(page_id, created_at ↓)` | |
| social_messages | `(user_id, created_at ↓)` | |
| api_keys | `key_hash` | **unique** |
| api_keys | `(user_id, created_at ↓)` | |
| api_keys | `expires_at` | **TTL** `expireAfterSeconds=0`, sparse |
| custom_metrics | `(user_id, created_at ↓)` | |
| custom_metrics | `(user_id, name)` | **unique** |

> **No declared indexes** (default `_id` only): `audit_logs`, `board_statuses`,
> `budget_goals`, `kpi_targets`, `media_tasks`, `notification_prefs`, `scheduled_posts`,
> `teams`, `pipelines`, `email_settings`.

---

## 5. Relationships

Most FKs are stringified ObjectIds. `→` means "references the `_id` of".

### User-owned (via `user_id → users._id`)
`connectors`, `marketing_data`, `reports`, `ai_queries`, `notifications` (**ObjectId**),
`notification_prefs`, `subscriptions` (1:1 unique), `whitelabel` (1:1 unique), `api_keys`,
`custom_metrics`, `rules`, `rule_triggers`, `email_schedules`, `scheduled_posts`,
`budget_goals`, `kpi_targets`, `social_messages`, `audit_logs`, `password_resets`.

### Connector / data chain
```
users ──1:N──► connectors ──1:N──► marketing_data
                   │  ▲                (user_id also denormalised on each doc)
                   │  └── sync_runs.connector_id
                   ├── scheduled_posts.connector_id
                   ├── budget_goals.connector_id
                   ├── rules.connector_id
                   ├── social_messages.connector_id
                   └── clients._id ◄── connectors.client_id  (agency assigns connector to client)
```

### RBAC
`users.role_id → roles._id`. Permission checks read `roles.permissions[module][action]`.

### Teams / projects / pipelines (workflow)
```
users ──► teams.members[].user_id ,  teams.created_by
teams ──► project_tasks.team_id ,  media_tasks.team_id ,  pipelines.nodes[].team_id
users ──► project_tasks.assigned_to / created_by / history[].actor_id
pipelines ──► project_tasks.pipeline_id
pipelines.nodes[].id ──► project_tasks.pipeline_node_id
project_tasks._id ──► project_tasks.pipeline_parent_task_id   (self-ref: routed/forked tasks)
board_statuses.key ──► project_tasks.status                   (status string keyed to columns)
```

### Rules / alerts
`rule_triggers.rule_id → rules._id`; `rule_triggers.user_id → users._id`.
`rules.campaign_id` matches `marketing_data.campaign_id` (a value, **not** a doc `_id`).

### Chat / notifications
`messages.from_user_id`, `messages.to_user_id → users._id`.
`notifications.user_id → users._id`; `metadata` often carries `task_id → project_tasks._id`,
`connector_id → connectors._id`.

### Clients (agency)
`clients.agency_user_id → users._id` (the agency owner). Connectors link back via
`connectors.client_id → clients._id`.

### Billing
`subscriptions.user_id → users._id`; external refs `stripe_customer_id`,
`stripe_subscription_id`. Plan definitions (`BILLING_PLANS`) are **static config** in
`routers/billing.py`, not a collection.

### Value-matched (not `_id` references)
`budget_goals.campaign_id`, `rules.campaign_id`, and `kpi_targets` (via `platform`/`metric`)
all key against `marketing_data` **values** for aggregation, rather than referencing a document `_id`.

---

## 6. Design notes & caveats

- **Denormalisation for reads:** `marketing_data` stores both `user_id` and `connector_id`,
  and precomputes `ctr`/`cpc`/`roas`, to keep the hot reporting queries index-only.
- **Idempotent syncs:** the `unique_data_point` compound unique index lets syncs upsert
  daily campaign rows safely without duplicates.
- **TTL cleanup:** `password_resets.expires_at` and `api_keys.expires_at` use MongoDB TTL
  indexes so expired docs are auto-purged.
- **Token security:** connector OAuth tokens are encrypted at rest
  (`encrypted_access_token`/`encrypted_refresh_token`, via `utils/encryption.py`).
- **Mixed FK types:** `notifications.user_id` is stored as an **ObjectId** while most other
  `user_id` fields are strings — be careful when querying/joining across collections.
- **Implicit collections:** the majority of collections have no Pydantic model and are shaped
  entirely by their service/router. Treat those services as the source of truth for field shape.
