# mediaERP — Routes Reference

> Every route in the system: **backend API** (FastAPI, prefix `/api/v1`) and **frontend
> pages** (Next.js App Router). For request/response detail see [api.doc.md](api.doc.md);
> for data see [db.architecture.md](db.architecture.md).
>
> Auth legend — **JWT**: `Authorization: Bearer <token>` · **Public**: no auth ·
> **SA**: Super Admin only · **Perm**: RBAC `check_permission(module, action)`.

---

## Backend API routes (`/api/v1`)

### Auth — `/auth`
`POST /register` · `POST /login` · `POST /refresh` · `GET /me` · `PUT /me` ·
`POST /logout` · `POST /forgot-password` · `POST /reset-password` · `PUT /password` ·
`POST /2fa/setup` · `POST /2fa/enable` · `POST /2fa/disable` · `GET /2fa/status` ·
`POST /onboarding/complete` · `GET /onboarding/status` ·
`POST /impersonate/{user_id}` (SA) · `POST /sso-login` (Public)

### Connectors — `/connectors`
`GET|POST /` · `GET|PUT|DELETE /{id}` · `GET /{platform}/auth` (JWT) ·
`GET /{platform}/callback` (Public/state) — platforms: google_ads, ga4, facebook_ads,
facebook_pages, instagram, instagram_login, linkedin_ads, tiktok_ads, mailchimp,
search_console, hubspot, shopify

### Sync — `/sync`
`POST /trigger/{connector_id}` · `GET /status/{connector_id}` · `GET /history/{connector_id}`

### Reports — `/reports`
`GET /overview` · `GET /campaigns` · `GET /trend` · `POST /custom` · `POST /blend` ·
`GET /export` · `GET|POST /saved` · `GET|PUT|DELETE /saved/{id}` ·
`POST|DELETE /saved/{id}/share` · `GET /shared/{token}` (**Public**)

### Analytics — `/analytics`
`GET /attribution` · `GET /anomalies`

### AI — `/ai`
`POST /query` · `GET /history` · `GET /history/{id}`

### Custom metrics — `/custom-metrics`
`GET|POST /` · `POST /preview` · `DELETE /{id}`

### FX — `/fx`
`GET /rates`

### Export — `/export`
`GET /campaigns/excel` · `GET /campaigns/pdf`

### Projects — `/projects`
`GET /` (role-scoped) · `POST /` · `GET /leader/queue` · **`GET /{task_id}`** (detail;
elevated/assignee/creator/team) · `PUT /{task_id}` · `DELETE /{task_id}`

### Board statuses — `/board-statuses`
`GET|POST /` · `PUT /reorder` · `PUT|DELETE /{id}`

### Teams — `/teams`
`GET /` · `GET /all` · `GET /users` · `POST /` · `GET|PUT|DELETE /{id}` ·
`POST /{id}/members` · `DELETE /{id}/members/{uid}` · `PUT /{id}/members/{uid}/role` ·
`GET /{id}/members/{uid}/report` · **`GET /{id}/members/{uid}/activity`** (period report)

### Pipelines — `/pipelines`
`GET|POST /` · `GET|PUT|DELETE /{id}` (create/edit = SA/Admin/Coordinator)

### Media schedule — `/media-schedule`
`POST /tasks` · `GET /tasks` · `PATCH|DELETE /tasks/{id}`

### Media / upload — `/media`
`POST /upload` · `POST /upload-attachments`

### Social — `/social`
Facebook: `GET /facebook/pages` · `POST /facebook/post` · `POST /facebook/dm` ·
`GET /facebook/posts` · `GET /facebook/posts/{id}/comments` ·
`GET /facebook/conversations` · `GET /facebook/conversations/{id}/messages`
Instagram: `GET /instagram/accounts` · `POST /instagram/post` · `POST /instagram/dm` ·
`GET /instagram/conversations` · `GET /instagram/conversations/{id}/messages`
Instagram Login: `GET /instagram_login/account` · `POST /instagram_login/post` ·
`GET /instagram_login/posts` · `GET /instagram_login/posts/{id}/comments` ·
`POST /instagram_login/posts/{id}/comments/{cid}/reply` · `GET /instagram_login/insights` ·
`GET /instagram_login/conversations` · `GET /instagram_login/conversations/{id}/messages` ·
`POST /instagram_login/dm` · `GET /webhook-messages`

### Schedule (social posts) — `/schedule`
`POST|GET /posts` · `GET|PATCH|DELETE /posts/{id}`

### Rules — `/rules`
`GET|POST /` · `PATCH|DELETE /{id}` · `GET /history` · `POST /evaluate`

### Budget — `/budget`
`GET|POST /goals` · `DELETE /goals/{id}` · `GET /alerts` · `GET /pacing`

### KPI targets — `/kpi-targets`
`GET|POST /` · `PUT|DELETE /{id}`

### Email reports — `/email-reports`
`GET|POST /schedules` · `PATCH|DELETE /schedules/{id}` · `POST /send-now/{id}` ·
`POST /test-email`

### Email/SMTP settings — `/settings` (SA)
`GET|PUT /email-smtp` · `POST /email-smtp/test`

### Email logs — `/email-logs` (SA) 🆕
`GET /` — paginated logs + stats (filters: status, category, search)

### Notification prefs — `/notification-prefs`
`GET|PUT /`

### Notifications — `/notifications`
`GET /` · `PATCH /{id}/read` · `POST /read-all`

### Chat — `/chat`
`WS /ws` · `GET /users` · `GET /messages/{other_id}` · `PUT /messages/{other_id}/read` ·
`GET /unread` · **`GET /groups`** · **`GET /groups/{id}/messages`** ·
**`POST /groups/{id}/report/send-now`** · `GET /admin/conversations` (SA) ·
`GET /admin/messages/{a}/{b}` (SA)

### Roles — `/roles`
`GET /` (SA) · `GET /all` · `POST /` (SA) · `GET|PUT|DELETE /{id}` (SA)

### Users — `/users`
`GET|POST /` (Perm) · `GET|PUT|DELETE /{id}` (Perm/self)

### Audit logs — `/audit-logs`
`GET /`

### API keys — `/api-keys`
`GET|POST /` · `DELETE /{id}` · `PATCH /{id}/toggle`

### Billing — `/billing`
`GET /plans` (Public) · `GET /subscription` · `GET /usage` · `POST /create-checkout` ·
`POST /create-portal` · `POST /webhook` (Public/Stripe)

### Clients — `/clients`
`GET|POST /` · `GET /stats` · `GET /:id/summary` · `PATCH|DELETE /{id}` · `POST /{id}/invite`

### Whitelabel — `/whitelabel`
`GET|PUT|DELETE /settings`

### WhatsApp — `/whatsapp`
`POST /test` · `PUT /phone`

### Webhooks — `/webhooks` (Public)
`GET|POST /facebook` · `GET|POST /instagram/deauthorize` · `GET|POST /instagram/delete`

### Health / static
`GET /api/v1/health` (Public) · `GET /uploads/{filename}` (static) ·
`GET /manifest.webmanifest` · `GET /sw.js` · `GET /icons/*` (PWA, public)

---

## Frontend routes (Next.js App Router)

### Public — `app/(auth)`
`/login` · `/register` · `/forgot-password` · `/reset-password`

### Public share
`/reports/shared/[token]` — read-only shared report

### Protected — `app/(dashboard)` (auth gate via `proxy.ts`)
| Route | Page |
|-------|------|
| `/dashboard` | Overview |
| `/connectors` | Data connectors + sync |
| `/reports`, `/reports/[id]` | Reports (analytics, builder, saved, blend) |
| `/analytics` | Attribution / anomalies |
| `/campaigns` | Campaigns + write actions + budget |
| `/schedule` | Scheduled social posts |
| `/rules` | Automated alert rules |
| `/email-reports` | Scheduled email reports |
| `/projects` | Kanban board + tasks |
| `/media-schedule` | Media production tasks |
| `/teams`, `/teams/[id]` | Teams + team detail |
| `/teams/[id]/members/[memberId]` | **Member profile** (report + daily report) |
| `/leader` | Leader Desk queue |
| `/ai` | AI natural-language queries |
| `/social`, `/social/dm` | Publishing + DMs |
| `/chat` | Team chat (DMs + groups) |
| `/clients` | Agency client management |
| `/users` | User management |
| `/roles` | Roles & permissions |
| **`/profile`** 🆕 | Current user's profile (edit, password, sign out) |
| **`/email-logs`** 🆕 | Email logs (**Super Admin only**) |
| `/settings`, `/settings/api-keys`, `/settings/custom-metrics` | Settings |

🆕 = added in the latest work. `GET /{task_id}`, member `/activity`, chat `/groups`, and
`/email-logs` are also new backend endpoints.
