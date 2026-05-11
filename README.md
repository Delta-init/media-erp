# mediaERP — Marketing Data Platform

> A Supermetrics-style marketing ETL + reporting + AI-query platform.  
> Connects Google Ads, GA4, Facebook Ads, LinkedIn Ads, and TikTok Ads into a unified
> dashboard with Gemini-powered natural-language queries.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 · FastAPI · Motor (async MongoDB) · Celery + Redis |
| Frontend | Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui · Framer Motion |
| AI | Google Gemini 2.5 Flash |
| Database | MongoDB (local dev) → MongoDB Atlas M0 (production) |
| Cache / Queue | Redis (local dev) → Upstash Redis (production) |
| Deployment | Railway (backend + worker) · Vercel (frontend) |
| Observability | Sentry (backend + frontend) |

---

## Quick Start — Local Development

### Prerequisites
- Python 3.12+
- Node.js 20+
- MongoDB running locally on port 27017
- Redis running locally on port 6379

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env          # fill in GEMINI_API_KEY at minimum
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs  
Health check: http://localhost:8000/api/v1/health

### 2. Celery Worker (optional — needed for scheduled syncs)

```bash
# In a second terminal (same venv activated)
cd backend
celery -A app.tasks.celery_app worker --loglevel=info -B
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:3000

---

## Full Stack with Docker Compose

```bash
# Build and start all services (backend, worker, beat, mongo, redis, frontend)
docker-compose up --build

# Backend:  http://localhost:8000
# Frontend: http://localhost:3000
# API docs: http://localhost:8000/docs  (development only)
```

---

## Environment Variables

### `backend/.env` (minimum for local dev)

```env
APP_ENV=development
DEBUG=true

MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=mediaerp

REDIS_URL=redis://localhost:6379/0

JWT_SECRET_KEY=any-random-string-for-dev
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Generate: openssl rand -hex 32
ENCRYPTION_KEY=c3a039e03db2be770182f6599262189b0b8659c3a12b9e6e5fda347be550f2c2

ALLOWED_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

TIKTOK_APP_ID=
TIKTOK_APP_SECRET=

# Required for AI features — get free key at aistudio.google.com
GEMINI_API_KEY=your-gemini-api-key

SENTRY_DSN=   # leave empty to disable
```

### `frontend/.env.local` (minimum for local dev)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME=mediaERP
NEXT_PUBLIC_SENTRY_DSN=   # leave empty to disable
```

---

## Production Deployment

### Backend → Railway

1. Push repo to GitHub
2. Railway → New Project → Deploy from GitHub → set Root Directory = `backend`
3. Railway auto-reads `backend/railway.json` and builds the Dockerfile
4. Add a second service (same repo, root = `backend`) using `Dockerfile.worker` for Celery
5. Set all env vars from `backend/.env.production` in Railway → Variables
6. Note the Railway public URL (e.g. `https://mediaerp-web-production.up.railway.app`)

### Frontend → Vercel

1. Vercel → New Project → Import from GitHub → Root Directory = `frontend`
2. Framework: Next.js (auto-detected)
3. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL = https://<railway-url>/api/v1
   NEXT_PUBLIC_APP_NAME = mediaERP
   ```
4. Deploy → copy Vercel URL → update `ALLOWED_ORIGINS` + `FRONTEND_URL` on Railway

### Managed Data Plane

| Service | Setup | URL format |
|---------|-------|-----------|
| **MongoDB Atlas** | cloud.mongodb.com → M0 free cluster | `mongodb+srv://user:pass@cluster.mongodb.net/mediaerp` |
| **Upstash Redis** | console.upstash.com → free database (TLS on) | `rediss://default:pass@host.upstash.io:port` |

Update `MONGODB_URL` and `REDIS_URL` in Railway env vars for both services.

### OAuth Redirect URIs

After getting your Railway URL, update each platform's developer console:

| Platform | Redirect URI |
|----------|-------------|
| Google Ads | `https://<railway-url>/api/v1/connectors/google_ads/callback` |
| GA4 | `https://<railway-url>/api/v1/connectors/ga4/callback` |
| Facebook | `https://<railway-url>/api/v1/connectors/facebook_ads/callback` |
| LinkedIn | `https://<railway-url>/api/v1/connectors/linkedin_ads/callback` |
| TikTok | `https://<railway-url>/api/v1/connectors/tiktok_ads/callback` |

Also set matching `*_REDIRECT_URI` env vars on Railway.

### Observability

- **Sentry backend:** Set `SENTRY_DSN` in Railway env vars. SDK is already wired in `app/main.py`.
- **Sentry frontend:** Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel env vars. SDK is wired in `instrumentation.ts` + `sentry.*.config.ts`.
- **UptimeRobot:** Create a monitor at uptimerobot.com pointing to `https://<railway-url>/api/v1/health` (HTTP monitor, 5-minute interval).

---

## Project Structure

```
mediaERP/
├── backend/
│   ├── app/
│   │   ├── main.py               FastAPI entry, CORS, Sentry init, routers
│   │   ├── config.py             Pydantic Settings (reads .env)
│   │   ├── database.py           Motor async client + index creation
│   │   ├── routers/              auth, connectors, sync, reports, ai, notifications
│   │   ├── models/               notification, marketing_data helpers
│   │   ├── services/             auth, connector, sync, ai, notification
│   │   ├── platforms/            google_ads, ga4, facebook_ads, linkedin_ads, tiktok_ads
│   │   ├── middleware/           get_current_user, require_plan
│   │   ├── schemas/              Pydantic v2 request/response models
│   │   ├── utils/                jwt, encryption, response, oauth
│   │   └── tasks/                celery_app, sync_tasks
│   ├── Dockerfile                Multi-stage production image (gunicorn + uvicorn)
│   ├── Dockerfile.worker         Celery worker + beat image
│   ├── railway.json              Railway web service config
│   ├── railway.worker.json       Railway worker service config
│   ├── requirements.txt
│   ├── .env                      Local dev (gitignored)
│   └── .env.production           Production template
├── frontend/
│   ├── app/                      Next.js App Router
│   │   ├── (auth)/               login, register
│   │   └── (dashboard)/          overview, connectors, reports, campaigns, ai, settings
│   ├── components/
│   │   ├── layout/               Sidebar, Header, NotificationBell
│   │   ├── shared/               KpiCard, DataTable, ConnectorCard, ...
│   │   ├── charts/               SpendTrendChart, PlatformDonut, ...
│   │   ├── ai/                   AiQueryPanel, AiResultCard
│   │   ├── connectors/           ConnectorGrid, AddConnectorModal, OAuthCallback
│   │   └── reports/              ReportBuilder, MetricSelector, FilterPanel
│   ├── hooks/                    useAuth, useConnectors, useReports, useAi, useNotifications
│   ├── lib/                      axios instance, animations, authStore, uiStore
│   ├── types/                    user, connector, report, campaign, notification
│   ├── sentry.client.config.ts   Browser Sentry (no-op without DSN)
│   ├── sentry.server.config.ts   Server Sentry
│   ├── sentry.edge.config.ts     Edge Sentry
│   ├── instrumentation.ts        Next.js register hook → loads Sentry
│   ├── next.config.ts            withSentryConfig wrapper (no-op without DSN)
│   ├── Dockerfile                3-stage production image (standalone)
│   ├── vercel.json               Vercel config + security headers
│   └── .env.production           Production env template
├── docker-compose.yml            Full local stack (6 services)
├── media-plan.md                 Feature roadmap
├── PROJECT_STATUS.md             Live feature checklist
└── README.md                     This file
```

---

## API Reference

All routes prefix: `/api/v1`

| Group | Method | Path | Auth | Description |
|-------|--------|------|------|-------------|
| Auth | POST | `/auth/register` | — | Register, returns JWT pair |
| Auth | POST | `/auth/login` | — | Login, returns JWT pair |
| Auth | POST | `/auth/refresh` | — | Rotate access token |
| Auth | GET | `/auth/me` | ✓ | Current user profile |
| Auth | PUT | `/auth/me` | ✓ | Update name / email |
| Auth | PUT | `/auth/password` | ✓ | Change password |
| Auth | POST | `/auth/logout` | ✓ | Logout |
| Connectors | GET | `/connectors` | ✓ | List connectors |
| Connectors | POST | `/connectors` | ✓ | Create connector record |
| Connectors | GET | `/connectors/{id}` | ✓ | Get connector |
| Connectors | PUT | `/connectors/{id}` | ✓ | Update connector |
| Connectors | DELETE | `/connectors/{id}` | ✓ | Delete connector |
| Connectors | GET | `/connectors/{platform}/auth` | ✓ | Get OAuth URL |
| Connectors | GET | `/connectors/{platform}/callback` | — | OAuth callback |
| Sync | POST | `/sync/trigger/{connector_id}` | ✓ | Trigger sync |
| Sync | GET | `/sync/status/{connector_id}` | ✓ | Sync status |
| Sync | GET | `/sync/history/{connector_id}` | ✓ | Sync history |
| Reports | GET | `/reports/overview` | ✓ | KPI totals + deltas |
| Reports | GET | `/reports/campaigns` | ✓ | Paginated campaign list |
| Reports | GET | `/reports/trend` | ✓ | Time-series data |
| Reports | POST | `/reports/custom` | ✓ | Custom aggregation |
| Reports | GET | `/reports/saved` | ✓ | List saved reports |
| Reports | POST | `/reports/saved` | ✓ | Save a report |
| Reports | GET | `/reports/saved/{id}` | ✓ | Get saved report |
| Reports | DELETE | `/reports/saved/{id}` | ✓ | Delete saved report |
| Reports | GET | `/reports/export` | ✓ | CSV export |
| AI | POST | `/ai/query` | ✓ | NL → Gemini → result + explanation |
| AI | GET | `/ai/history` | ✓ | Past queries (paginated) |
| AI | GET | `/ai/history/{id}` | ✓ | Single query |
| Notifications | GET | `/notifications` | ✓ | List notifications |
| Notifications | PATCH | `/notifications/{id}/read` | ✓ | Mark one read |
| Notifications | POST | `/notifications/read-all` | ✓ | Mark all read |
| Health | GET | `/health` | — | Service health check |

---

## Feature Progress

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the complete phase-by-phase checklist.

---

*Built for Carlton Trading Academy — Supermetrics clone*
