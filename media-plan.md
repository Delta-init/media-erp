# Supermetrics Clone — Full Build Plan (Updated)

> **Stack:** Python FastAPI · MongoDB · Next.js 15 (App Router) · TailwindCSS 3 · shadcn/ui · Framer Motion · Claude AI
> **Frontend style:** Mirrors Carlton CRM conventions — same patterns, same libraries, adapted for marketing intelligence

---

## ⚡ Agent Rules (Mirrors Carlton CRM)

Every code change follows the 6-step protocol:

1. **Pre-Change Summary** — what, which files, APIs involved, uncertainties → wait for confirm
2. **Wait for confirmation** before any code
3. **Check history files** before writing: `mistakes.md`, `servicesHistory.md`, `componentsHistory.md`, `apiHistory.md`
4. **Sub-agent 4-case test** after every change (Happy Path / Edge / Error / Auth)
5. **Verification (mandatory)** — verify once that the tests actually ran and produced real output before responding. Never claim ✅ PASS from intent alone.
6. **Post-Change Report** — files changed, docs updated, test results, "Verified: Yes"

---

## 🏗 Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend framework | **Python FastAPI** | REST API, OAuth2 flows, async |
| Database | **MongoDB** (Motor async ODM) | Flexible schema for marketing data |
| Task queue | **Celery + Redis** | Scheduled data syncs per connector |
| Backend auth | **JWT** (access 15min + refresh 7d) | Same pattern as Carlton CRM |
| Frontend | **Next.js 15** (App Router, latest) | `create-next-app@latest` |
| Styling | **TailwindCSS 3.x + shadcn/ui** | Same as Carlton CRM |
| Animation | **Framer Motion 11** (mandatory every component) | Import only from `lib/animations.ts` |
| Theme | **next-themes** (light/dark/system — always in header) | `defaultTheme="system"` |
| Server state | **TanStack React Query v5** | All API calls through hooks |
| Client state | **Zustand** | Auth store, UI state |
| Forms | **React Hook Form + Zod** | Same pattern as Carlton CRM |
| HTTP | **Axios** | Auto Bearer token via `lib/axios.ts` |
| Charts | **Recharts** | KPI trends, platform breakdowns |
| Toasts | **Sonner** | Same as Carlton CRM |
| Icons | **Lucide React** | Same as Carlton CRM |
| Font | **DM Sans** (via next/font/google) | Clean, modern, matches dashboard aesthetic |

### Ports & URIs
- **Backend**: `http://localhost:8000`
- **Frontend**: `http://localhost:3000`
- **MongoDB**: `mongodb://localhost:27017/supermetrics_db`
- **All API routes**: `/api/v1/`
- Backend env: `backend/.env`
- Frontend env: `frontend/.env.local`

---

## 🗂 Project Layout

```
supermetrics-clone/
├── CLAUDE.md                   ← Agent rulebook (mirrors Carlton CRM)
├── PLAN.md                     ← This file — living roadmap
├── PROJECT_STATUS.md           ← Current state, last item, pending issues
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── main.py             ← FastAPI entry, CORS, routers
│   │   ├── config.py           ← Pydantic settings from .env
│   │   ├── database.py         ← Motor async MongoDB connection
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── connector.py
│   │   │   ├── marketing_data.py
│   │   │   └── report.py
│   │   ├── routers/
│   │   │   ├── auth.py         ← register, login, refresh, me
│   │   │   ├── connectors.py   ← CRUD + OAuth flow per platform
│   │   │   ├── sync.py         ← trigger, status, history
│   │   │   ├── reports.py      ← overview, campaigns, trend, custom
│   │   │   └── ai.py           ← Claude NL query endpoint
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── connector_service.py
│   │   │   ├── google_ads.py
│   │   │   ├── facebook_ads.py
│   │   │   ├── ga4.py
│   │   │   ├── linkedin.py
│   │   │   ├── tiktok.py
│   │   │   └── ai_service.py
│   │   ├── tasks/
│   │   │   ├── celery_app.py   ← Celery + Redis config
│   │   │   └── sync_tasks.py   ← Async sync workers + Celery Beat
│   │   ├── middleware/
│   │   │   ├── auth.py         ← JWT verify → inject user
│   │   │   └── permissions.py  ← role-based module/action check
│   │   └── utils/
│   │       ├── response.py     ← success_response() / error_response()
│   │       ├── oauth.py        ← OAuth2 PKCE helpers
│   │       └── encryption.py   ← encrypt/decrypt OAuth tokens at rest
│   ├── tests/
│   │   ├── helpers/
│   │   │   ├── auth.py         ← get_token(), api() helpers
│   │   │   └── factory.py      ← test data factories
│   │   ├── test_auth.py
│   │   ├── test_connectors.py
│   │   ├── test_reports.py
│   │   └── test_sync.py
│   ├── mistakes.md             ← All past bugs + fixes
│   ├── servicesHistory.md      ← All service methods
│   ├── middlewareHistory.md    ← Middleware stack
│   ├── features.md             ← All backend features
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
└── frontend/
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   └── (dashboard)/
    │       ├── layout.tsx          ← Sidebar + Header shell
    │       ├── page.tsx            ← Redirect → /dashboard/overview
    │       ├── overview/page.tsx   ← KPI dashboard home
    │       ├── connectors/page.tsx ← Add/manage data sources
    │       ├── reports/
    │       │   ├── page.tsx        ← Report builder
    │       │   └── [id]/page.tsx   ← Saved report detail
    │       ├── campaigns/page.tsx  ← Campaign-level breakdown
    │       ├── ai/page.tsx         ← Claude AI query interface
    │       └── settings/page.tsx   ← Account, plan, API keys
    ├── components/
    │   ├── ui/                     ← shadcn/ui primitives (never edit directly)
    │   ├── shared/
    │   │   ├── DataTable.tsx       ← Unified table with sort/filter
    │   │   ├── Pagination.tsx
    │   │   ├── ResponsiveModal.tsx
    │   │   ├── ConfirmDialog.tsx
    │   │   ├── PageHeader.tsx      ← Page title + action slot
    │   │   ├── EmptyState.tsx
    │   │   ├── LoadingSkeleton.tsx
    │   │   ├── SearchInput.tsx     ← Debounced
    │   │   ├── ThemeToggle.tsx     ← Light/Dark/System switcher
    │   │   ├── KpiCard.tsx         ← Metric card with trend arrow
    │   │   ├── ConnectorCard.tsx   ← Platform card with status badge
    │   │   ├── SyncStatusBadge.tsx ← connected/syncing/error/disconnected
    │   │   └── DateRangePicker.tsx
    │   ├── charts/
    │   │   ├── SpendTrendChart.tsx ← Line chart — daily spend over time
    │   │   ├── PlatformDonut.tsx   ← Spend/clicks split by platform
    │   │   ├── CampaignBarChart.tsx
    │   │   └── RoasGauge.tsx
    │   ├── overview/
    │   │   └── OverviewGrid.tsx    ← KPI cards grid
    │   ├── connectors/
    │   │   ├── ConnectorGrid.tsx
    │   │   ├── AddConnectorModal.tsx
    │   │   └── OAuthCallback.tsx
    │   ├── reports/
    │   │   ├── ReportBuilder.tsx
    │   │   ├── MetricSelector.tsx
    │   │   └── FilterPanel.tsx
    │   └── ai/
    │       ├── AiQueryPanel.tsx    ← NL input → Claude response
    │       └── AiResultCard.tsx
    ├── hooks/                      ← React Query hooks (one file per domain)
    │   ├── useAuth.ts
    │   ├── useConnectors.ts
    │   ├── useReports.ts
    │   ├── useCampaigns.ts
    │   ├── useSync.ts
    │   └── useAi.ts
    ├── lib/
    │   ├── axios.ts                ← Axios instance (auto Bearer token)
    │   ├── animations.ts           ← ALL Framer Motion variants (import from here only)
    │   └── stores/
    │       ├── authStore.ts        ← Zustand — user, token, logout
    │       └── uiStore.ts          ← sidebar collapsed, active filters
    ├── providers/
    │   ├── QueryProvider.tsx       ← TanStack React Query wrapper
    │   └── ThemeProvider.tsx       ← next-themes wrapper
    ├── types/
    │   ├── connector.ts
    │   ├── report.ts
    │   ├── campaign.ts
    │   └── user.ts
    ├── mistakes.md
    ├── componentsHistory.md
    ├── apiHistory.md
    ├── features.md
    └── design.md
```

---

## 🎨 Design Rules (Same as Carlton CRM)

### Font
**DM Sans** — loaded via `next/font/google`. Never system-ui, Arial, or Helvetica.

### Theme Switcher — Always Present
- `next-themes` wraps entire app in `layout.tsx`
- `ThemeToggle` always in top header
- `defaultTheme="system"` — never hardcode light or dark

### Colours — Semantic Tokens Only
```tsx
// NEVER
<div className="bg-white text-gray-900 border-gray-200">

// ALWAYS
<div className="bg-card text-card-foreground border-border">
```

| Token | Use for |
|---|---|
| `bg-background` | Page background |
| `bg-card` | Card / panel background |
| `bg-muted` | Subtle secondary background |
| `bg-primary` | Brand colour — buttons, active states |
| `text-foreground` | Primary body text |
| `text-muted-foreground` | Secondary / helper text |
| `border-border` | Default borders |

### Framer Motion — MANDATORY ON EVERY COMPONENT

Import variants only from `lib/animations.ts` — never inline.

| Component type | Required animation |
|---|---|
| Every page | `pageVariants` — fade + slide up |
| Every list/grid | `listContainerVariants` + `listItemVariants` — stagger |
| Every card (KPI, connector) | `listItemVariants` + `whileHover={cardHoverVariants.hover}` |
| Every modal | `modalVariants` with `AnimatePresence` |
| Every sidebar panel | `slideInVariants` |
| Every button | `whileTap={{ scale: 0.97 }}` |
| Every badge | `initial={{ scale: 0 }} animate={{ scale: 1 }}` |
| Theme toggle | `AnimatePresence` y-axis swap |

### Admin Panel UI Rules
- Sidebar active item: `bg-primary/10 text-primary border-l-2 border-primary` + `whileHover={{ x: 2 }}`
- KPI cards: coloured icon bg (`bg-primary/10`), value in `text-foreground`, trend badge in green/red
- Platform connector cards: logo + status badge + last synced timestamp
- Every loading state: `LoadingSkeleton` matching actual layout shape
- Every empty state: icon + primary action button — never just text

---

## 📋 MongoDB Schemas

### Users Collection
```json
{
  "_id": "ObjectId",
  "email": "safvan@carltonedu.com",
  "hashed_password": "bcrypt",
  "name": "Safvan",
  "role": "admin | viewer | editor",
  "plan": "free | starter | pro | enterprise",
  "connected_platforms": ["google_ads", "facebook_ads"],
  "created_at": "ISODate"
}
```

### Connectors Collection
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "platform": "google_ads | ga4 | facebook_ads | linkedin_ads | tiktok_ads",
  "status": "connected | syncing | error | disconnected",
  "access_token": "AES-256 encrypted",
  "refresh_token": "AES-256 encrypted",
  "account_id": "123-456-7890",
  "account_name": "Carlton Trading - Main",
  "sync_frequency": "hourly | daily | manual",
  "last_synced": "ISODate",
  "error_message": "null or string",
  "created_at": "ISODate"
}
```

### Marketing Data Collection (Unified Schema)
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "connector_id": "ObjectId",
  "platform": "google_ads",
  "date": "2025-01-15",
  "account_id": "123-456",
  "campaign_id": "456789",
  "campaign_name": "Brand Awareness Q1",
  "metrics": {
    "impressions": 45000,
    "clicks": 1200,
    "spend": 350.00,
    "conversions": 48,
    "revenue": 2400.00,
    "ctr": 2.67,
    "cpc": 0.29,
    "roas": 6.86
  },
  "dimensions": {
    "device": "mobile | desktop | tablet",
    "country": "AE",
    "currency": "AED"
  },
  "synced_at": "ISODate"
}
```

### Reports Collection (Saved Reports)
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "name": "Q1 2025 Overview",
  "metrics": ["spend", "roas", "clicks"],
  "dimensions": ["platform", "campaign"],
  "filters": { "platform": ["google_ads"], "date_range": "last_30d" },
  "chart_type": "line | bar | donut | table",
  "created_at": "ISODate"
}
```

---

## 🔌 All API Endpoints

### Auth — `/api/v1/auth`
```
POST /register              → create user, return JWT pair
POST /login                 → email + password → JWT pair
POST /refresh               → refresh token → new access token
GET  /me                    → current user profile
POST /logout                → invalidate refresh token
```

### Connectors — `/api/v1/connectors`
```
GET  /                      → list all connectors for user
POST /                      → create connector record (pre-OAuth)
GET  /:id                   → single connector detail
PUT  /:id                   → update sync frequency
DELETE /:id                 → disconnect + delete tokens

GET  /:platform/auth        → redirect to platform OAuth consent
GET  /:platform/callback    → exchange code → store tokens → redirect to /connectors
```

### Sync — `/api/v1/sync`
```
POST /trigger/:connector_id → manually trigger sync
GET  /status                → all connectors + last_synced + status
GET  /history/:connector_id → sync job history (last 20)
```

### Reports — `/api/v1/reports`
```
GET  /overview?date_from=&date_to=&platform=
GET  /campaigns?platform=&limit=&page=
GET  /trend?metric=&period=
POST /custom
GET  /saved
POST /saved
GET  /saved/:id
DELETE /saved/:id
GET  /export?format=csv
```

### AI — `/api/v1/ai`
```
POST /query                 → { question } → Claude pipeline → result + explanation
GET  /history               → past AI queries
```

---

## 🗺 Build Phases — Feature-by-Feature

> Each numbered feature is a single unit of work that goes through the 6-step protocol once.
> "Depends on" lists the feature IDs that must ship first.

---

### Phase 1 — Scaffold + Auth (Week 1)

#### 1.1 Mono-repo skeleton
- **Backend:** create `backend/` with `app/`, `tests/`, `requirements.txt`, `Dockerfile`, `.env.example`
- **Frontend:** create `frontend/` via `create-next-app@latest` (TS + Tailwind + App Router)
- **Root:** `.gitignore`, `docker-compose.yml` skeleton, `README.md`, `PROJECT_STATUS.md`
- **Depends on:** —

#### 1.2 Backend bootstrap
- `app/main.py` — FastAPI app, CORS, lifespan, `/health` endpoint
- `app/config.py` — Pydantic Settings from `.env`
- `app/database.py` — Motor client + `get_db` dep + `create_indexes` on startup
- `app/utils/response.py` — `success_response()` / `error_response()`
- **Depends on:** 1.1

#### 1.3 Backend history file stubs
- Create empty `backend/mistakes.md`, `servicesHistory.md`, `middlewareHistory.md`, `features.md`
- **Depends on:** 1.1

#### 1.4 Frontend bootstrap
- Install pinned packages (Framer Motion, RQ, Zustand, RHF + Zod, Axios, Sonner, Lucide, Recharts, next-themes, shadcn/ui)
- `app/layout.tsx` — DM Sans via `next/font/google`, html lang, body wrapper
- `lib/axios.ts` — Axios instance with bearer interceptor + 401 redirect
- `lib/animations.ts` — all Framer Motion variants (page/list/modal/slide/fade/cardHover)
- **Depends on:** 1.1

#### 1.5 Frontend providers
- `providers/QueryProvider.tsx` — TanStack RQ client + Devtools (dev only)
- `providers/ThemeProvider.tsx` — next-themes wrapper, `defaultTheme="system"`
- `app/layout.tsx` — wire both + `<Toaster />` from Sonner
- **Depends on:** 1.4

#### 1.6 Frontend history file stubs
- Create empty `frontend/mistakes.md`, `componentsHistory.md`, `apiHistory.md`, `features.md`, `design.md`
- **Depends on:** 1.1

#### 1.7 Auth domain — backend models & utils
- `models/user.py` — User document (email, hashed_password, name, role, plan, timestamps)
- `utils/jwt.py` — `create_access_token`, `create_refresh_token`, `decode_access_token`
- `utils/encryption.py` — AES-256-GCM encrypt/decrypt for tokens
- Index: `users.email` unique
- **Depends on:** 1.2

#### 1.8 Auth middleware
- `middleware/auth.py` — `get_current_user` dependency (validates JWT, loads user)
- `middleware/permissions.py` — `require_plan(plan)` dependency
- **Depends on:** 1.7

#### 1.9 Auth endpoints — register & login
- `services/auth_service.py` — `register_user`, `authenticate_user`, password bcrypt
- `routers/auth.py` — `POST /auth/register`, `POST /auth/login`
- `schemas/auth.py` — Pydantic v2 request/response models
- **Depends on:** 1.7, 1.8

#### 1.10 Auth endpoints — refresh, me, logout
- `POST /auth/refresh` (rotate access token)
- `GET /auth/me` (returns current user)
- `POST /auth/logout` (invalidate refresh token — store revoked-token set in Redis later)
- **Depends on:** 1.9

#### 1.11 Frontend auth store + hook
- `lib/stores/authStore.ts` — Zustand: `user`, `accessToken`, `refreshToken`, `setSession`, `logout`
- `hooks/useAuth.ts` — `useLogin`, `useRegister`, `useMe`, `useLogout`, `useRefresh`
- `types/user.ts` — `IUser` shape from API
- **Depends on:** 1.5, 1.10

#### 1.12 Shared UI primitives — first batch
- `shared/ThemeToggle.tsx` (with AnimatePresence sun↔moon swap)
- `shared/PageHeader.tsx`
- `shared/LoadingSkeleton.tsx`
- `shared/EmptyState.tsx`
- Log each in `componentsHistory.md`
- **Depends on:** 1.5

#### 1.13 Login & Register pages
- `app/(auth)/login/page.tsx` — RHF + Zod, calls `useLogin`
- `app/(auth)/register/page.tsx` — RHF + Zod, calls `useRegister`
- Both with `pageVariants`, Sonner success/error toasts
- **Depends on:** 1.11, 1.12

#### 1.14 Route guard
- `middleware.ts` — redirect unauthenticated users hitting `/(dashboard)/*` → `/login`
- Placeholder `(dashboard)/layout.tsx` and `(dashboard)/page.tsx` redirect → `/dashboard/overview`
- **Depends on:** 1.13

---

### Phase 2 — Connector System (Week 2)

#### 2.1 Connector model + service
- `models/connector.py` — Connector document (encrypted tokens, status, sync_frequency, etc.)
- `services/connector_service.py` — `list`, `get`, `create`, `update`, `delete`, `save_tokens`
- Indexes: `(user_id, 1)`, `(user_id, platform)` unique
- **Depends on:** 1.7

#### 2.2 Connector CRUD endpoints
- `routers/connectors.py` — `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- All routes protected via `get_current_user`
- **Depends on:** 2.1

#### 2.3 OAuth shared helpers
- `utils/oauth.py` — PKCE helpers, state nonce store (Redis), token-exchange wrapper
- **Depends on:** 1.7

#### 2.4 Google Ads OAuth + connector
- `services/platforms/google_ads.py` — `get_auth_url`, `exchange_code`, `refresh_access_token`
- `GET /connectors/google_ads/auth` + `GET /connectors/google_ads/callback`
- **Depends on:** 2.2, 2.3

#### 2.5 GA4 OAuth + connector
- `services/platforms/ga4.py` (reuses Google client where possible)
- `GET /connectors/ga4/auth` + `/callback`
- **Depends on:** 2.4

#### 2.6 Facebook Ads OAuth + connector
- `services/platforms/facebook_ads.py`
- `GET /connectors/facebook_ads/auth` + `/callback`
- **Depends on:** 2.3

#### 2.7 Frontend connector types & hooks
- `types/connector.ts` — `IConnector`, `Platform` enum
- `hooks/useConnectors.ts` — `useConnectors`, `useConnector`, `useCreateConnector`, `useUpdateConnector`, `useDeleteConnector`
- **Depends on:** 1.11, 2.2

#### 2.8 Shared UI primitives — second batch
- `shared/SyncStatusBadge.tsx` — connected / syncing / error / disconnected
- `shared/ConnectorCard.tsx` — logo + status + last synced
- `shared/ResponsiveModal.tsx` — Dialog on desktop, Sheet on mobile
- `shared/ConfirmDialog.tsx` — disconnect/delete confirmation
- **Depends on:** 1.12

#### 2.9 Add Connector modal
- `components/connectors/AddConnectorModal.tsx` — platform picker → triggers OAuth window
- RHF + Zod for sync_frequency selection
- **Depends on:** 2.7, 2.8

#### 2.10 Connectors page (initial)
- `app/(dashboard)/connectors/page.tsx` + `components/connectors/ConnectorGrid.tsx`
- Stagger animation on grid via `listContainerVariants` + `listItemVariants`
- Empty state + loading skeleton
- **Depends on:** 2.9

#### 2.11 OAuth callback handler (frontend)
- `components/connectors/OAuthCallback.tsx` — reads `?connected=platform` query, fires toast, invalidates `["connectors"]`
- **Depends on:** 2.10, 2.4

---

### Phase 3 — Data Sync Pipeline (Week 3)

#### 3.1 Marketing data model + indexes
- `models/marketing_data.py` — unified schema
- Indexes incl. unique compound `(user_id, platform, date, campaign_id)` named `unique_data_point`
- **Depends on:** 2.1

#### 3.2 Celery + Redis bootstrap
- `tasks/celery_app.py` — Celery instance + Beat schedule (hourly)
- `database.py` — sync wrapper for Celery context (`get_sync_db`)
- Compose service for `celery-worker` + `celery-beat`
- **Depends on:** 1.2

#### 3.3 Sync service core
- `services/sync_service.py` — platform-agnostic upsert logic
- `tasks/sync_tasks.py` — `sync_connector(connector_id)` + `run_scheduled_syncs()`
- Status transitions: connected → syncing → connected/error + `error_message`
- **Depends on:** 3.1, 3.2

#### 3.4 Google Ads `fetch_data`
- Add `fetch_data(connector)` to `services/platforms/google_ads.py`
- Map response → unified `marketing_data` shape
- **Depends on:** 2.4, 3.3

#### 3.5 GA4 `fetch_data`
- Add `fetch_data(connector)` to `services/platforms/ga4.py`
- **Depends on:** 2.5, 3.3

#### 3.6 Facebook Ads `fetch_data`
- Add `fetch_data(connector)` to `services/platforms/facebook_ads.py`
- **Depends on:** 2.6, 3.3

#### 3.7 Sync trigger + status endpoints
- `POST /sync/trigger/:connector_id` (enqueue Celery task, return job id)
- `GET /sync/status` (all connectors with last_synced + status)
- `GET /sync/history/:connector_id` (last 20 sync runs from a `sync_runs` collection)
- **Depends on:** 3.3

#### 3.8 LinkedIn Ads OAuth + sync
- `services/platforms/linkedin.py` (auth + fetch)
- `/connectors/linkedin_ads/auth` + `/callback`
- **Depends on:** 2.3, 3.3

#### 3.9 TikTok Ads OAuth + sync
- `services/platforms/tiktok.py` (auth + fetch)
- `/connectors/tiktok_ads/auth` + `/callback`
- **Depends on:** 2.3, 3.3

#### 3.10 Frontend sync hooks + UI wiring
- `hooks/useSync.ts` — `useSyncStatus` (poll every 30s), `useTriggerSync`, `useSyncHistory`
- `ConnectorCard` — manual trigger button + live `SyncStatusBadge` from `useSyncStatus`
- **Depends on:** 2.10, 3.7

---

### Phase 4 — Reports API + Charts (Week 3–4)

#### 4.1 Reports overview endpoint
- `GET /reports/overview?date_from=&date_to=&platform=`
- Aggregation: $match → $group → $sum across spend/clicks/impressions/conversions/revenue
- Returns 6 KPI totals + period-over-period delta
- **Depends on:** 3.1

#### 4.2 Campaigns endpoint
- `GET /reports/campaigns?platform=&page=&limit=`
- Paginated list with sort and search
- **Depends on:** 3.1

#### 4.3 Trend endpoint
- `GET /reports/trend?metric=spend&period=daily|weekly`
- Returns time-series array for charts
- **Depends on:** 3.1

#### 4.4 Custom report endpoint
- `POST /reports/custom` — body: `{ metrics, dimensions, filters, chart_type }` → executes pipeline
- **Depends on:** 4.1

#### 4.5 Saved reports CRUD
- `models/report.py`
- `GET /reports/saved`, `POST /reports/saved`, `GET /reports/saved/:id`, `DELETE /reports/saved/:id`
- **Depends on:** 4.4

#### 4.6 CSV export
- `GET /reports/export?format=csv` — streams CSV from same aggregation as `/custom`
- **Depends on:** 4.4

#### 4.7 Frontend types + hooks
- `types/report.ts`, `types/campaign.ts`
- `hooks/useReports.ts` — overview/trend/custom/saved hooks
- `hooks/useCampaigns.ts`
- **Depends on:** 4.1–4.6

#### 4.8 Shared UI primitives — third batch
- `shared/DataTable.tsx` — sortable, filterable, mobile-collapsing
- `shared/Pagination.tsx`
- `shared/SearchInput.tsx` — debounced
- `shared/DateRangePicker.tsx`
- `shared/KpiCard.tsx`
- **Depends on:** 1.12

#### 4.9 Chart components
- `charts/SpendTrendChart.tsx` (Recharts line)
- `charts/PlatformDonut.tsx` (Recharts pie)
- `charts/CampaignBarChart.tsx` (Recharts bar)
- `charts/RoasGauge.tsx` (Recharts radial)
- All wrapped in `fadeVariants` mount animation
- **Depends on:** 1.4

---

### Phase 5 — Dashboard UI Polish (Week 4–5)

#### 5.1 App layout shell
- `lib/stores/uiStore.ts` — sidebar collapsed state, active filters
- `components/layout/Sidebar.tsx` — collapsible, active item with `border-l-2 border-primary`, `whileHover={{ x: 2 }}`
- `components/layout/Header.tsx` — breadcrumbs + ThemeToggle + avatar dropdown
- `app/(dashboard)/layout.tsx` — wires both
- **Depends on:** 1.14, 2.10

#### 5.2 Overview page
- `components/overview/OverviewGrid.tsx` — 6 `KpiCard` grid with stagger
- `app/(dashboard)/overview/page.tsx` — KPI grid + SpendTrendChart + PlatformDonut + top campaigns DataTable
- **Depends on:** 4.7, 4.8, 4.9, 5.1

#### 5.3 Campaigns page
- `app/(dashboard)/campaigns/page.tsx` — DataTable + Pagination + DateRangePicker + platform filter
- **Depends on:** 4.7, 4.8, 5.1

#### 5.4 Report builder
- `components/reports/MetricSelector.tsx` (multi-select metrics)
- `components/reports/FilterPanel.tsx` (platform, date range, dimensions)
- `components/reports/ReportBuilder.tsx` (combines selector + filter + chart toggle + save)
- **Depends on:** 4.7, 4.8, 4.9

#### 5.5 Reports pages
- `app/(dashboard)/reports/page.tsx` — saved list + ReportBuilder
- `app/(dashboard)/reports/[id]/page.tsx` — saved report detail
- CSV export button wired to `GET /reports/export`
- **Depends on:** 5.4, 4.6

---

### Phase 6 — AI Layer (Week 5–6)

#### 6.1 AI service — pipeline generator
- `services/ai_service.py` — `generate_pipeline(question, schema, user_id)` calls Claude (`claude-sonnet-4-6`)
- Returns validated MongoDB aggregation array
- **Depends on:** 3.1

#### 6.2 AI service — executor + explainer
- Execute the generated pipeline against `marketing_data`
- Second Claude call to explain the result in plain English
- Persist `{ user_id, question, pipeline, result, explanation, created_at }` to `ai_queries`
- **Depends on:** 6.1

#### 6.3 AI endpoints
- `POST /ai/query`
- `GET /ai/history`
- **Depends on:** 6.2

#### 6.4 Frontend AI hook
- `hooks/useAi.ts` — `useAiQuery` mutation, `useAiHistory` query
- **Depends on:** 6.3

#### 6.5 AI panel + result card
- `components/ai/AiQueryPanel.tsx` — question input + history sidebar
- `components/ai/AiResultCard.tsx` — explanation + raw pipeline (collapsible) + Recharts auto-render based on result shape
- Reveal animations via `fadeVariants` + `listItemVariants`
- **Depends on:** 4.9, 6.4

#### 6.6 AI page
- `app/(dashboard)/ai/page.tsx` — combines panel + result card
- **Depends on:** 6.5, 5.1

**Claude System Prompt:**
```
You are a marketing data analyst with access to a MongoDB collection called
marketing_data. Schema: [schema]. Generate a valid MongoDB aggregation pipeline
as a JSON array to answer the question. Return only JSON, no explanation, no markdown.
```

---

### Phase 7 — Settings + Notifications (Week 6)

#### 7.1 Profile + password endpoints
- `PUT /auth/me` — update name, email
- `PUT /auth/password` — verify current, set new, invalidate refresh tokens
- **Depends on:** 1.10

#### 7.2 Notifications backend
- `models/notification.py` — `{ user_id, type, message, read, created_at }`
- Sync tasks emit notifications on success/failure
- `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`
- **Depends on:** 3.3

#### 7.3 Settings page
- `app/(dashboard)/settings/page.tsx` — Profile / Password / Plan badge / API keys (read-only display)
- Tabs via shadcn `Tabs`, RHF + Zod for both forms
- **Depends on:** 5.1, 7.1

#### 7.4 Notification bell
- `components/layout/NotificationBell.tsx` — badge count + dropdown list
- Polls `GET /notifications` every 60s
- Sonner toast fires on new sync events received via polling diff
- **Depends on:** 5.1, 7.2

---

### Phase 8 — Deployment (Week 7)

#### 8.1 Docker Compose (full local stack)
- `docker-compose.yml`: backend, celery-worker, celery-beat, mongo, redis, frontend
- Healthchecks, volume mounts, `.env` wiring
- **Depends on:** 3.2

#### 8.2 Backend Dockerfile (production)
- Multi-stage build, non-root user, `uvicorn` with proper workers
- **Depends on:** 8.1

#### 8.3 Frontend Dockerfile (production)
- `next build` standalone output, `next start` runtime
- `.dockerignore` to exclude `node_modules`, `.next/cache`
- **Depends on:** 8.1

#### 8.4 Production deploy — Backend + Celery on Railway
- Two services: `web` (FastAPI), `worker` (Celery + Beat in same container or split)
- Env vars from Railway secrets
- **Depends on:** 8.2

#### 8.5 Production deploy — Frontend on Vercel
- Connect repo, set `NEXT_PUBLIC_API_URL` env to Railway URL
- **Depends on:** 8.3

#### 8.6 Managed data plane
- MongoDB Atlas M0 cluster + IP allowlist
- Upstash Redis instance + URL into both Railway services
- **Depends on:** 8.4

#### 8.7 Observability
- Sentry SDK in backend (`sentry_sdk[fastapi]`) and frontend (`@sentry/nextjs`)
- Healthcheck monitoring (UptimeRobot or Better Uptime)
- **Depends on:** 8.4, 8.5

#### 8.8 Final docs
- Update `README.md` with run instructions
- Seed `PROJECT_STATUS.md` with current state
- Verify all `.md` history files reflect shipped reality
- **Depends on:** all prior

---

## 🔑 Credentials Checklist

### Marketing APIs

| Platform | What You Need | Where |
|---|---|---|
| Google Ads | OAuth2 Client ID + Secret + Developer Token | console.cloud.google.com |
| GA4 | Same Google Cloud OAuth2 client — enable GA4 Data API | Same Cloud Console |
| Meta / Facebook | App ID + App Secret | developers.facebook.com |
| LinkedIn | Client ID + Client Secret | linkedin.com/developers |
| TikTok | App ID + App Secret | business-api.tiktok.com |

### Infrastructure

| Service | Credential |
|---|---|
| MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/supermetrics_db` |
| Upstash Redis | `redis://default:pass@host:port` |
| Anthropic | `ANTHROPIC_API_KEY` from console.anthropic.com |
| Token encryption | 32-byte `ENCRYPTION_KEY` → `openssl rand -hex 32` |

### `backend/.env`
```env
MONGODB_URL=mongodb://localhost:27017/supermetrics_db
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_ACCESS_EXPIRE_MINUTES=15
JWT_REFRESH_EXPIRE_DAYS=7
ENCRYPTION_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/connectors/google_ads/callback

META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=http://localhost:8000/api/v1/connectors/facebook_ads/callback

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/v1/connectors/linkedin_ads/callback

TIKTOK_APP_ID=
TIKTOK_APP_SECRET=
TIKTOK_REDIRECT_URI=http://localhost:8000/api/v1/connectors/tiktok_ads/callback

ANTHROPIC_API_KEY=
FRONTEND_URL=http://localhost:3000
```

### `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Supermetrics Clone
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
```

---

## 📦 Frontend Package Versions (Pinned)

```json
{
  "next": "latest",
  "react": "^19.0.0",
  "typescript": "^5.6.0",
  "tailwindcss": "^3.4.6",
  "framer-motion": "^11.3.2",
  "next-themes": "^0.3.0",
  "@tanstack/react-query": "^5.51.1",
  "zustand": "^4.5.4",
  "react-hook-form": "^7.52.1",
  "zod": "^3.23.8",
  "axios": "^1.7.2",
  "sonner": "^1.5.0",
  "lucide-react": "^0.411.0",
  "recharts": "^3.8.1",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.4.0"
}
```

---

## 🔁 Global Component Registry

| Component | File | Purpose |
|---|---|---|
| `DataTable` | `shared/DataTable.tsx` | All tables — campaigns, reports |
| `Pagination` | `shared/Pagination.tsx` | All paginated lists |
| `ResponsiveModal` | `shared/ResponsiveModal.tsx` | All modals |
| `ConfirmDialog` | `shared/ConfirmDialog.tsx` | Disconnect/delete confirmations |
| `PageHeader` | `shared/PageHeader.tsx` | Page title + action slot |
| `EmptyState` | `shared/EmptyState.tsx` | No connectors, no data yet |
| `LoadingSkeleton` | `shared/LoadingSkeleton.tsx` | Matches actual layout shape |
| `SearchInput` | `shared/SearchInput.tsx` | Debounced |
| `ThemeToggle` | `shared/ThemeToggle.tsx` | Always in header |
| `KpiCard` | `shared/KpiCard.tsx` | All metric summary cards |
| `ConnectorCard` | `shared/ConnectorCard.tsx` | Platform grid cards |
| `SyncStatusBadge` | `shared/SyncStatusBadge.tsx` | connected/syncing/error/disconnected |
| `DateRangePicker` | `shared/DateRangePicker.tsx` | All date filters |

---

## 📅 Milestone Timeline

| Week | Phase | Deliverable |
|---|---|---|
| Week 1 | Phase 1 | Scaffold + full auth (register/login/JWT/protected routes) |
| Week 2 | Phase 2 | Connector system + Google Ads + GA4 + Facebook OAuth |
| Week 3 | Phase 3 | Celery sync pipeline + LinkedIn + TikTok connectors |
| Week 3–4 | Phase 4 | All report API endpoints + aggregations |
| Week 4–5 | Phase 5 | Full dashboard UI — overview, connectors, reports pages |
| Week 5–6 | Phase 6 | Claude AI query interface |
| Week 6 | Phase 7 | Settings page + notifications |
| Week 7 | Phase 8 | Docker Compose + production deploy |
| Week 8 | QA | Error handling, edge cases, Sentry monitoring |

---

## 💰 Cost Estimate (Monthly)

| Service | Free Tier | Paid |
|---|---|---|
| MongoDB Atlas | M0 free (512MB) | $57/mo (M10) |
| Upstash Redis | 10K commands/day free | $10/mo |
| Railway (FastAPI + Celery) | $5 credit/mo | ~$20/mo |
| Vercel (Next.js) | Free (Hobby) | Free |
| Anthropic API | Pay per use | ~$10–50/mo |
| **Total** | **~$0 to start** | **~$100/mo** |

---

*Generated for Carlton Trading Academy — Supermetrics Clone Build Plan*
*Updated: Next.js 15 · Carlton CRM frontend conventions · DM Sans · Framer Motion mandatory*
