# mediaERP — Project Documentation

> One-stop overview of the platform: what it is, how it's built, and where everything
> lives. Deep-dives live in the companion docs.
>
> **Companion docs:** [routes.md](routes.md) · [api.doc.md](api.doc.md) ·
> [db.architecture.md](db.architecture.md) · [email-sending-doc.md](email-sending-doc.md) ·
> [PROJECT.md](PROJECT.md)

---

## 1. What it is

mediaERP is a **marketing data + agency-operations platform**. It connects a team's ad,
analytics, CRM, email, SEO and e-commerce accounts into one workspace and adds team
operations on top:

- **Data integration (ETL):** OAuth into Google Ads, GA4, Facebook Ads/Pages, Instagram,
  LinkedIn Ads, TikTok Ads, Mailchimp, Search Console, HubSpot, Shopify → normalised into
  a unified `marketing_data` collection, synced hourly/daily/on-demand.
- **Reporting:** overview KPIs, campaign tables, trends, custom report builder,
  cross-platform blend, saved & public-shared reports, PDF/Excel export, custom metrics.
- **AI:** natural-language → MongoDB aggregation → result + explanation (Gemini primary,
  Ollama fallback).
- **Team ops:** teams + RBAC, Kanban projects with a workflow state-machine, team-to-team
  approval **pipelines**, media production schedule, real-time **chat** (DMs + team groups),
  notifications.
- **Social:** publish + DM on Facebook/Instagram, read conversations/comments, inbound
  webhook DMs.
- **Growth:** Stripe billing & plans, agency client management, per-user white-label,
  API keys, audit logs.
- **Automation:** threshold alert rules, scheduled email reports, budget pacing, KPI
  targets, anomaly detection, and a **9 PM IST team daily-report bot** in chat.

---

## 2. Stack

| Layer | Tech |
|------|------|
| Backend | Python 3.12 · FastAPI · Motor (async Mongo) · Celery + Redis |
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind v4 · Zustand · TanStack Query |
| DB / cache | MongoDB (Atlas in prod) · Redis (Upstash) |
| AI | Gemini `1.5-flash` · Ollama fallback |
| Storage | Cloudflare R2 (S3) + local `uploads/` fallback |
| Email | SMTP (Gmail App Password) — see [email-sending-doc.md](email-sending-doc.md) |
| Payments / msg | Stripe · WhatsApp Cloud API · Meta Graph API |
| Deploy | Vercel (frontend) · Railway (backend + worker) · Sentry |
| PWA | Manifest + service worker (installable, offline-capable) |

---

## 3. Layout

```
media-erp/
├── backend/app/
│   ├── main.py            # routers, CORS, rate-limit, lifespan daemons
│   ├── config.py          # env settings (auto-derives OAuth redirect URIs)
│   ├── database.py        # Motor (async) + PyMongo (sync for Celery/email logs), indexes
│   ├── routers/           # 40 HTTP/WS routers  → routes.md / api.doc.md
│   ├── services/          # business logic (sync, ai, reports, rules, chat, email, ...)
│   ├── models/ schemas/   # document shapes + request/response DTOs
│   ├── platforms/         # per-platform OAuth + API clients
│   ├── middleware/        # auth, permissions, rate_limit
│   ├── tasks/             # Celery app + beat
│   └── utils/             # jwt, encryption, storage, email (+ email logging)
├── frontend/
│   ├── app/(auth)/ (dashboard)/   # pages  → routes.md
│   ├── app/manifest.ts  public/sw.js  components/PWARegister.tsx   # PWA
│   ├── proxy.ts           # Next 16 middleware — auth gate (excludes /api, /icons, PWA)
│   ├── hooks/ stores/ lib/ components/ providers/
└── *.md                   # this doc + companions
```

---

## 4. Background jobs

- **Celery + beat:** hourly `run_scheduled_syncs`; daily `scan_anomalies_all_users` (02:00 UTC).
- **In-process daemon threads** (FastAPI lifespan): social post scheduler (~60s), rules
  evaluator (~5min), email-report scheduler (~1min), media-schedule activator (~60s),
  **group daily-report scheduler** (posts each team's report at **21:00 IST**).

---

## 5. Access model (RBAC)

Permissions = **modules × actions** stored per role (`roles` collection). Modules:
dashboard, connectors, reports, campaigns, projects, teams, ai, users, roles, settings,
schedule, rules, email_reports, social, chat, clients, pipeline. Actions: view, create,
edit, delete, export. Preset roles: **Super Admin, Admin, Coordinator, Team Leader,
Employee, Viewer** (+ legacy Manager). Frontend mirrors via `authStore.hasPermission`.

Some surfaces are **Super Admin only**: role management, chat monitoring, SMTP settings,
and the **Email Logs** page.

---

## 6. Notable recent features

- **Chat groups:** one group per team, two-way real-time chat, task `@mentions` with live
  status chips, media attachments, optimistic instant-send + delivery ticks, and an
  automated **9 PM IST daily report** (team summary + per-member done/pending).
- **Task DMs:** on assign → assignee + creator; on complete → team leader(s) + creator —
  delivered as chat DMs with a clickable task reference.
- **Profile:** `/profile` self-service page (edit name/email, change password, sign out);
  member profile at `/teams/{id}/members/{memberId}` with a period daily report.
- **Email logs:** every send attempt recorded to `email_logs`; Super-Admin `/email-logs`
  page (see [email-sending-doc.md](email-sending-doc.md)).
- **PWA:** installable, offline-capable, API-safe service worker.
- **Mobile:** responsive chat (master-detail), reports, projects; fixed the mobile drawer
  click-lock.

---

## 7. Run it locally

Prereqs: Python 3.12, Node 20, MongoDB :27017, Redis :6379.

```bash
# backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt && cp .env.example .env   # set GEMINI_API_KEY (+ SMTP)
uvicorn app.main:app --reload --port 8000

# frontend  (⚠ modified Next.js 16 — read frontend/AGENTS.md before editing)
cd frontend && npm install && npm run dev      # http://localhost:3000
```

Health: `http://localhost:8000/api/v1/health` · Docs (debug): `/docs`.

---

## 8. Conventions

- Responses wrapped by `success_response(...)`; frontend reads `data.data`.
- Foreign keys are stringified ObjectIds (a few IDs like `campaign_id` match `marketing_data`
  values, not `_id`s). `notifications.user_id` is an ObjectId (others are strings).
- Connector tokens encrypted at rest. `.env`/secrets are git-ignored.
- Multi-contributor repo → **sync with git before any work**; branch before pushing to `main`.
