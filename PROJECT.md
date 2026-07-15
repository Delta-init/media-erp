# mediaERP — Project Document

> A Supermetrics-style marketing **ETL + reporting + AI-query** platform with a full
> agency operations layer (teams, kanban workflows, pipelines, social publishing,
> client management, billing, and white-labeling).
>
> This document is the high-level map of the system. For the HTTP surface see
> [api.doc.md](api.doc.md); for the data model see [db.architecture.md](db.architecture.md).

---

## 1. What the product does

mediaERP connects a marketing team's advertising, analytics, CRM, email, SEO and
e-commerce platforms into one workspace and layers agency operations on top:

- **Data integration (ETL)** — OAuth into Google Ads, GA4, Facebook Ads, Facebook Pages,
  Instagram, LinkedIn Ads, TikTok Ads, Mailchimp, Search Console, HubSpot, Shopify.
  Metrics are normalised into a single `marketing_data` collection and synced on a
  schedule (hourly/daily) or on demand.
- **Reporting** — overview KPIs, campaign tables, trend charts, custom report builder,
  cross-platform data blending, saved reports, public share links, and PDF/Excel export.
- **AI querying** — natural-language questions are translated into MongoDB aggregation
  pipelines, executed, and explained back to the user (Gemini primary, Ollama fallback).
- **Agency operations** — teams, role-based access control, a kanban project/task board
  with a formal task workflow, team-to-team approval **pipelines**, a media production
  schedule, real-time chat, and notifications.
- **Social management** — publish and DM on Facebook Pages and Instagram, read
  conversations/comments, and receive inbound DMs via Meta webhooks.
- **Growth/monetisation** — Stripe billing & plans, usage limits, client management for
  agencies, and per-user white-label branding.
- **Automation** — threshold-based alerting rules, scheduled email reports, scheduled
  social posts, budget pacing, KPI targets, and anomaly detection.

---

## 2. Technology stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 · FastAPI · Motor (async MongoDB) · Celery + Redis |
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Framer Motion |
| State/data (FE) | Zustand (auth/UI) · TanStack Query · Axios · React Hook Form + Zod |
| AI | Google Gemini (`gemini-1.5-flash`) primary · Ollama (`llama3.2`) local fallback |
| Database | MongoDB (local dev → MongoDB Atlas in production) |
| Cache / Queue | Redis (local → Upstash in production) |
| Object storage | Cloudflare R2 (S3-compatible) with local-disk `uploads/` fallback |
| Payments | Stripe (checkout, billing portal, webhooks) |
| Messaging | WhatsApp Cloud API · Meta Graph API (FB/IG) |
| Deployment | Railway (backend + worker) · Vercel (frontend) |
| Observability | Sentry (backend + frontend, no-op when DSN unset) |

Pinned backend versions live in [backend/requirements.txt](backend/requirements.txt);
frontend deps in [frontend/package.json](frontend/package.json).

---

## 3. Repository layout

```
media-erp/
├── backend/                    # FastAPI application
│   └── app/
│       ├── main.py             # App factory: routers, CORS, rate-limit, lifespan daemons
│       ├── config.py           # Pydantic Settings (env-driven; auto-derives OAuth redirect URIs)
│       ├── database.py         # Motor (async) + PyMongo (sync for Celery), index creation
│       ├── routers/            # 39 HTTP/WS routers → see api.doc.md
│       ├── services/           # Business logic (sync, ai, reports, rules, workflow, ...)
│       ├── models/             # Pydantic document shapes + doc-builder helpers
│       ├── schemas/            # Request/response DTOs
│       ├── platforms/          # Per-platform OAuth + API clients (google_ads, ga4, meta, ...)
│       ├── middleware/         # auth, permissions, rate_limit
│       ├── tasks/              # Celery app + sync tasks + beat schedule
│       └── utils/              # jwt, encryption, oauth, redis, storage, email, response
├── frontend/                   # Next.js app (App Router)
│   ├── app/(auth)/             # login, register, forgot/reset password
│   ├── app/(dashboard)/        # all authed feature pages
│   ├── app/reports/shared/     # public shared-report view (no auth)
│   ├── hooks/                  # 35 data hooks (one per API area) → see api.doc.md
│   ├── stores/                 # Zustand: authStore, uiStore
│   ├── lib/                    # axios client, platform metadata, utils, animations
│   ├── components/             # feature + shadcn/ui components
│   └── providers/              # React Query / theme providers
├── delta-enrolment-form-main/  # Separate enrolment-form sub-app
├── scripts/                    # Ops/seed scripts
├── docker-compose.yml          # backend, worker, beat, mongo, redis, frontend
└── *.md                        # README, PROJECT_STATUS, USER_ROLE_MANAGEMENT, design, this doc
```

---

## 4. Architecture at a glance

```
                     ┌──────────────────────────────────────────────┐
     Browser         │                 Next.js 16 (Vercel)          │
  ────────────►      │  App Router pages · hooks · Zustand · Axios   │
                     │  bearer token in localStorage + cookie        │
                     └───────────────┬──────────────────────────────┘
                                     │ HTTPS  /api/v1/*  (JWT bearer)
                                     ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                         FastAPI backend (Railway)                      │
   │  CORS → RateLimitMiddleware → routers → services → Motor              │
   │  Lifespan daemon threads: post-scheduler, rules-evaluator,           │
   │       email-scheduler, media-scheduler                               │
   └───────┬───────────────────┬────────────────┬───────────────┬─────────┘
           │                   │                │               │
           ▼                   ▼                ▼               ▼
     ┌──────────┐        ┌───────────┐    ┌───────────┐   ┌──────────────┐
     │ MongoDB  │        │  Redis    │    │ Cloudflare│   │ External APIs │
     │ (Atlas)  │        │ cache +   │    │    R2     │   │ Google/Meta/  │
     │          │        │ Celery    │    │ (uploads) │   │ TikTok/LinkedIn│
     └──────────┘        │ broker    │    └───────────┘   │ Stripe/WhatsApp│
                         └─────┬─────┘                     │ Gemini/Ollama │
                               │                           └──────────────┘
                               ▼
                     ┌───────────────────────┐
                     │  Celery worker + beat  │
                     │  hourly scheduled sync │
                     │  daily anomaly scan    │
                     └───────────────────────┘
```

### Request flow
1. Frontend attaches `Authorization: Bearer <access_token>` via the axios request interceptor.
2. `RateLimitMiddleware` and the auth dependency (`get_current_user`) gate the request;
   many endpoints additionally enforce RBAC via `check_permission(module, action)`.
3. Routers delegate to `services/`, which read/write MongoDB through Motor.
4. On `401`, the axios response interceptor silently refreshes via `POST /auth/refresh`
   and retries (single-flight, queued). Failure hard-redirects to `/login`.

### Background processing
- **Celery + beat** ([tasks/celery_app.py](backend/app/tasks/celery_app.py)): `run_scheduled_syncs`
  hourly, `scan_anomalies_all_users` daily at 02:00 UTC.
- **In-process daemon threads** started in the FastAPI lifespan
  ([main.py](backend/app/main.py)): social **post scheduler** (~60s), **rules evaluator**
  (~5min), **email report scheduler** (~1min), **media schedule activator** (~60s).

---

## 5. Core domains

| Domain | Purpose | Key collections |
|--------|---------|-----------------|
| **Auth & RBAC** | JWT auth, refresh, OTP reset, 2FA scaffold, SSO, impersonation; per-module/action permission matrix | `users`, `roles`, `password_resets` |
| **Connectors & Sync** | OAuth to 12 platforms; scheduled/manual data sync with run history | `connectors`, `sync_runs` |
| **Marketing data** | Unified daily campaign metrics | `marketing_data` |
| **Reporting** | Overview/campaigns/trend, custom builder, blend, saved & shared reports, custom metric formulas | `reports`, `custom_metrics` |
| **AI** | NL → aggregation pipeline → result + explanation | `ai_queries` |
| **Projects & Workflow** | Kanban tasks with a status state-machine, timing, history, attachments | `project_tasks`, `board_statuses` |
| **Teams & Pipelines** | Teams with leader/member roles; team-to-team approval routing graphs | `teams`, `pipelines` |
| **Media schedule** | Production tasks activated on schedule | `media_tasks` |
| **Social** | FB/IG publishing, DMs, conversations, comments; scheduled posts; inbound webhook DMs | `scheduled_posts`, `social_messages` |
| **Automation** | Threshold rules + trigger log, scheduled email reports, budget pacing, KPI targets | `rules`, `rule_triggers`, `email_schedules`, `budget_goals`, `kpi_targets` |
| **Notifications & Chat** | In-app notifications, 1:1 real-time chat (WebSocket) | `notifications`, `notification_prefs`, `messages` |
| **Agency / Billing** | Client management, Stripe subscriptions & usage limits, white-label branding, API keys, audit logs | `clients`, `subscriptions`, `whitelabel`, `api_keys`, `audit_logs` |

Full endpoint-by-endpoint breakdown: [api.doc.md](api.doc.md).
Full schema, indexes and relationships: [db.architecture.md](db.architecture.md).

---

## 6. Roles & permissions (RBAC)

Permissions are a matrix of **modules × actions** stored per role in the `roles` collection.

- **Modules:** dashboard, connectors, reports, campaigns, projects, teams, ai, users,
  roles, settings, schedule, rules, email_reports, social, chat, clients, pipeline.
- **Actions:** view, create, edit, delete, export.

Preset role templates live in [backend/app/models/role.py](backend/app/models/role.py):
Super Admin (all), Admin (all except `roles`), Coordinator, Team Leader, Employee, Viewer.
The frontend mirrors this via `authStore.hasPermission(module, action)` (Super Admin bypass).
See [USER_ROLE_MANAGEMENT.md](USER_ROLE_MANAGEMENT.md) for the detailed policy.

---

## 7. Local development

### Prerequisites
Python 3.12+, Node.js 20+, MongoDB on :27017, Redis on :6379.

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # set GEMINI_API_KEY at minimum
uvicorn app.main:app --reload --port 8000
```
API docs (debug only): http://localhost:8000/docs · Health: http://localhost:8000/api/v1/health

### Celery worker (for scheduled syncs)
```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info -B
```

### Frontend
```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

> ⚠️ The frontend uses a **modified Next.js 16** — read
> [frontend/AGENTS.md](frontend/AGENTS.md) and the guides in `node_modules/next/dist/docs/`
> before changing frontend code; APIs and conventions may differ from stock Next.js.

### Full stack (Docker)
```bash
docker-compose up --build     # backend, worker, beat, mongo, redis, frontend
```

---

## 8. Configuration (environment)

All backend config is driven by env vars via `pydantic-settings`
([backend/app/config.py](backend/app/config.py)). Highlights:

| Group | Keys |
|-------|------|
| Core | `APP_ENV`, `DEBUG`, `APP_PORT`, `ALLOWED_ORIGINS`, `FRONTEND_URL`, `PUBLIC_BASE_URL` |
| Data | `MONGODB_URL`, `MONGODB_DB_NAME`, `REDIS_URL` |
| Auth | `JWT_SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES` (15), `REFRESH_TOKEN_EXPIRE_DAYS` (7), `ENCRYPTION_KEY` |
| AI | `GEMINI_API_KEY`, `GEMINI_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` |
| OAuth | Google/Facebook/Instagram/LinkedIn/TikTok client id/secret (redirect URIs auto-derived from `PUBLIC_BASE_URL`) |
| Storage | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` |
| Messaging | `WHATSAPP_*`, `MAIL_*` (SMTP), `FACEBOOK_WEBHOOK_VERIFY_TOKEN` |
| Observability | `SENTRY_DSN` |

Frontend: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`).

---

## 9. Conventions & things to know

- **Response envelope** — the backend wraps responses in a `success_response(...)`
  envelope (`utils/response.py`); the frontend reads `data.data` accordingly.
- **Token encryption** — connector OAuth tokens are encrypted at rest (`utils/encryption.py`).
- **Foreign keys** — relationships are stringified ObjectIds (not DBRefs); some IDs
  (e.g. `campaign_id`) key against `marketing_data` values, not document `_id`s.
- **Two FE HTTP clients** — most hooks use the shared axios instance (auto-refresh on 401);
  six (`useBilling`, `useClients`, `useEmailReports`, `useExport`, `useRules`,
  `useWhitelabel`) use a raw `fetch` wrapper **without** auto-refresh.
- **git discipline** — this repo has multiple contributors; always sync with git before
  starting work (see [CLAUDE.md](CLAUDE.md)). Never force-push or hard-reset without asking.

---

## 10. Related documents

- [README.md](README.md) — quick start & stack summary
- [api.doc.md](api.doc.md) — complete REST/WebSocket API reference + frontend consumption map
- [db.architecture.md](db.architecture.md) — collections, fields, indexes, relationships
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — feature/phase status
- [USER_ROLE_MANAGEMENT.md](USER_ROLE_MANAGEMENT.md) — RBAC policy detail
- [design.md](design.md) — UI/UX design notes
- [backend_agents.md](backend_agents.md) · [frontend_agents.md](frontend_agents.md) · [media-plan.md](media-plan.md)
