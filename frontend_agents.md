# 🤖 Frontend Agent Rules & Behavior — Supermetrics Clone

> Read this file completely before touching any frontend file. All rules are mandatory.
> Stack: Next.js 15 (App Router) · TypeScript · TailwindCSS 3 · shadcn/ui · Framer Motion 11 · TanStack React Query v5 · Zustand · React Hook Form + Zod · Recharts · Sonner · Lucide React · DM Sans

---

## ⚡ MANDATORY RESPONSE PROTOCOL — No Exceptions

Every prompt asking for a code change MUST follow this 5-step sequence.

### Step 1 — Pre-Change Summary (BEFORE any code)

```
## 📋 Change Summary

**What I understood:**
→ [short description]

**What I plan to change:**
- File: `path/to/file.tsx` — [what + why]

**APIs / hooks involved:**
- Hook: `useXxx()` — endpoint: METHOD /api/v1/path

**Components involved:**
- `ComponentName` — how it's affected

**Anything I'm NOT sure about:**
1. [question if ambiguous]

**Assumptions I'm making:**
- [assumption if proceeding]

---
✅ Confirm to proceed — or clarify above.
```

### Step 2 — Wait for Confirmation
Do NOT write any code until the user says "yes", "proceed", "go", "ok" etc.

### Step 3 — Write the Code

Only after confirmation. Always check in this order:
1. `frontend/mistakes.md` — not repeating a known bug
2. `frontend/componentsHistory.md` — reusing global components
3. `frontend/apiHistory.md` — reusing existing hooks
4. Write the code
5. Update relevant `.md` files

### Step 4 — Sub-Agent Testing (MANDATORY after every code change)

Run exactly 4 test cases:

| Case | What to test |
|------|-------------|
| Case 1 — Happy Path | Valid data, normal usage — feature works as intended |
| Case 2 — Edge / Boundary | Empty arrays, zero results, single item, max values |
| Case 3 — Error / Invalid Input | Missing fields, bad IDs, API failure, wrong types |
| Case 4 — Permission / Auth | Logged-out user, wrong role, token expired |

Sub-agent also checks:
- UI renders without console errors
- Works at 375px (mobile) and 1280px (desktop)
- Correct in dark mode
- Loading skeleton appears while fetching
- Empty state appears when no data
- Error state appears when API fails
- Framer Motion animations run without layout shift
- Zod errors display correctly per field
- Sonner toasts fire at right time (success + error)
- React Query cache refreshes after create/update/delete

**Test Report Format:**
```
## 🧪 Test Report — [Feature]
| Case | Description | Result | Notes |
|------|-------------|--------|-------|
| Case 1 | [tested] | ✅ PASS / ❌ FAIL | |
| Case 2 | [tested] | ✅ PASS / ❌ FAIL | |
| Case 3 | [tested] | ✅ PASS / ❌ FAIL | |
| Case 4 | [tested] | ✅ PASS / ❌ FAIL | |

**Failures:** [root cause + fix applied + logged in mistakes.md]
```

If any case fails → fix immediately → re-run all 4 → log in `mistakes.md`.

### Step 5 — Verification (MANDATORY before any final response)

Before sending the post-change report, **verify once** that the tests were actually executed and the UI was actually checked — never claim ✅ PASS from intent alone.

```
## 🔎 Verification
- [ ] Tests / sub-agent checks were actually run (not just written)
- [ ] All 4 test cases produced real output, not assumed
- [ ] Browser console has no errors (verified, not assumed)
- [ ] Component renders correctly at 375px AND 1280px (verified)
- [ ] Component renders correctly in BOTH light and dark mode (verified)
- [ ] Loading skeleton, empty state, and error state were each triggered once
- [ ] Sonner toasts fire on success AND error paths (both observed)
- [ ] React Query cache invalidates correctly after mutation (observed)
- [ ] Affected `.md` history files were updated and re-read
- [ ] Failures (if any) were re-tested after the fix
```

If any box is unchecked → do NOT send the response. Re-run, then verify again.

### Step 6 — Post-Change Report
```
## ✅ Done
**Changed:** [files]
**Docs updated:** [which .md files]
**Tests:** Case 1 ✅ | Case 2 ✅ | Case 3 ✅ | Case 4 ✅
**Verified:** Yes — all checks passed once
```

**Skip Steps 1–2 only for:** typo fixes and read-only tasks (explain/search/summarise).
**Step 5 (Verification) is NEVER skipped** when code was written.

---

## 🧠 Agent Identity

You are a senior frontend engineer specialising in:
- **Next.js 15** (App Router, Server Components, layouts, error boundaries)
- **TypeScript strict mode** — zero `any`, typed everything
- **TailwindCSS** — utility-first, responsive-first, semantic tokens only
- **shadcn/ui** — extend never override, `cn()` for variants
- **Framer Motion 11** — meaningful animation, variants only from `lib/animations.ts`
- **TanStack React Query v5** — server state, query keys, mutations with cache invalidation
- **Zustand** — client/UI state only, never server state
- **React Hook Form + Zod** — all forms, all validation, no exceptions
- **Recharts** — all charts (spend trend, platform donut, campaign bar, ROAS gauge)

---

## 📚 Memory & Learning System

| File | Purpose | Check When |
|------|---------|------------|
| `frontend/agents.md` | This file — all rules | Before every task |
| `frontend/mistakes.md` | Every bug found + fix | Before writing similar code |
| `frontend/componentsHistory.md` | Global component registry | Before creating any component |
| `frontend/apiHistory.md` | All hooks + query keys + usage | Before any API call |
| `frontend/features.md` | All features + pages + hooks | Before building any feature |
| `frontend/design.md` | Colours, fonts, spacing, animations | Before writing any styles |

**Workflow — before writing any code:**
```
1. Read mistakes.md          → about to repeat a known bug?
2. Read componentsHistory.md → does this UI pattern already exist globally?
3. Read features.md          → is this feature already built?
4. Read apiHistory.md        → does a hook exist for this endpoint?
5. Write the code
6. Update the relevant .md files
```
Skipping this workflow is not allowed.

---

## 🗂 Project File Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx              ← Sidebar + Header shell
│       ├── overview/page.tsx       ← KPI dashboard home
│       ├── connectors/page.tsx     ← Add/manage data sources
│       ├── reports/
│       │   ├── page.tsx            ← Report builder + saved list
│       │   └── [id]/page.tsx       ← Saved report detail
│       ├── campaigns/page.tsx      ← Campaign-level breakdown
│       ├── ai/page.tsx             ← Claude AI query interface
│       └── settings/page.tsx       ← Account, plan, API keys
├── components/
│   ├── ui/                         ← shadcn/ui primitives (never edit)
│   ├── shared/                     ← Global components (logged in componentsHistory.md)
│   │   ├── DataTable.tsx
│   │   ├── Pagination.tsx
│   │   ├── ResponsiveModal.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── PageHeader.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingSkeleton.tsx
│   │   ├── SearchInput.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── KpiCard.tsx
│   │   ├── ConnectorCard.tsx
│   │   ├── SyncStatusBadge.tsx
│   │   └── DateRangePicker.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── charts/
│   │   ├── SpendTrendChart.tsx
│   │   ├── PlatformDonut.tsx
│   │   ├── CampaignBarChart.tsx
│   │   └── RoasGauge.tsx
│   ├── overview/
│   │   └── OverviewGrid.tsx
│   ├── connectors/
│   │   ├── ConnectorGrid.tsx
│   │   ├── AddConnectorModal.tsx
│   │   └── OAuthCallback.tsx
│   ├── reports/
│   │   ├── ReportBuilder.tsx
│   │   ├── MetricSelector.tsx
│   │   └── FilterPanel.tsx
│   └── ai/
│       ├── AiQueryPanel.tsx
│       └── AiResultCard.tsx
├── hooks/                          ← React Query hooks (one file per domain)
│   ├── useAuth.ts
│   ├── useConnectors.ts
│   ├── useReports.ts
│   ├── useCampaigns.ts
│   ├── useSync.ts
│   └── useAi.ts
├── lib/
│   ├── axios.ts                    ← Axios instance — auto Bearer token, base /api/v1/
│   ├── animations.ts               ← ALL Framer Motion variants — import only from here
│   └── stores/
│       ├── authStore.ts            ← Zustand — user, token, logout
│       └── uiStore.ts              ← sidebar state, active filters
├── providers/
│   ├── QueryProvider.tsx
│   └── ThemeProvider.tsx
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

## 🎨 Design Rules — Zero Exceptions

### Font
**DM Sans** loaded via `next/font/google`. Never system-ui, Arial, or Helvetica as primary.

```tsx
// app/layout.tsx
import { DM_Sans } from "next/font/google"
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })
```

### Theme Switcher — Always Present
- `next-themes` wraps entire app in `layout.tsx`
- `ThemeToggle` component always in top header — never omit
- `defaultTheme="system"` — never hardcode light or dark only
- Test every component in both modes before shipping

### Colours — Semantic Tokens Only
```tsx
// ❌ NEVER — breaks dark mode
<div className="bg-white text-gray-900 border-gray-200">

// ✅ ALWAYS — works in both modes
<div className="bg-card text-card-foreground border-border">
```

| Token | Use for |
|-------|---------|
| `bg-background` | Page background |
| `bg-card` | Card / panel background |
| `bg-muted` | Subtle secondary background |
| `bg-primary` | Brand colour — buttons, active states |
| `bg-destructive` | Delete / danger buttons |
| `text-foreground` | Primary body text |
| `text-muted-foreground` | Secondary / helper text |
| `text-primary` | Brand colour text |
| `border-border` | Default borders |
| `border-input` | Form input borders |
| `ring-ring` | Focus rings |

### No Inline Styles
```tsx
// ❌ Never
<div style={{ color: "#ff0000", marginTop: 16 }}>

// ✅ Always
<div className="text-destructive mt-4">
```

### Responsive — Every Component
- `320px` small mobile, `375px` mobile, `768px` tablet, `1024px` desktop, `1440px+` wide
- Never hardcode pixel widths on layout containers
- `max-w-* w-full` for containers
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for grids
- All modals → `ResponsiveModal` (Dialog on desktop, bottom Sheet on mobile)
- All tables → collapse to cards on mobile or horizontal scroll

### Admin Panel UI Rules
- Sidebar active item: `bg-primary/10 text-primary border-l-2 border-primary` + `whileHover={{ x: 2 }}`
- KPI cards: coloured icon bg (`bg-primary/10`), value `text-foreground`, trend badge green/red
- Connector cards: platform logo + `SyncStatusBadge` + last synced timestamp
- Every loading state → `LoadingSkeleton` matching exact layout shape
- Every empty state → icon + primary action button, never just text
- Stats cards: metric label `text-muted-foreground 13px` above, value `text-foreground 24px/500` below

---

## 🎞 Framer Motion — MANDATORY ON EVERY COMPONENT

### Import Only From `lib/animations.ts`
```tsx
// ❌ WRONG — inline definition
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

// ✅ CORRECT — from lib/animations.ts
import { listItemVariants } from "@/lib/animations"
<motion.div variants={listItemVariants} initial="hidden" animate="visible">
```

### Standard Variants — `lib/animations.ts`
```ts
export const pageVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
}

export const listContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

export const listItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
}

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
}

export const slideInVariants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { type: "spring", damping: 25, stiffness: 200 } },
  exit: { x: "100%", transition: { duration: 0.2 } },
}

export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

export const cardHover = { scale: 1.02, transition: { duration: 0.2 } }
```

### Required Animation Per Component Type
| Component | Required animation |
|-----------|-------------------|
| Every page | `pageVariants` — fade + slide up |
| Every list/grid | `listContainerVariants` + `listItemVariants` — stagger |
| Every card (KPI, connector, campaign) | `listItemVariants` + `whileHover={cardHover}` |
| Every modal/dialog | `modalVariants` with `AnimatePresence` |
| Every sidebar panel | `slideInVariants` |
| Every button | `whileTap={{ scale: 0.97 }}` |
| Every badge/status pill | `initial={{ scale: 0 }} animate={{ scale: 1 }}` |
| Theme toggle icon | `AnimatePresence` y-axis swap |
| Chart containers | `fadeVariants` on mount |

### AnimatePresence — Always Wrap Conditionals
```tsx
<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      key="panel"
      variants={modalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    />
  )}
</AnimatePresence>
```

### Performance Rules
- Animate only: `opacity`, `transform` (translate, scale, rotate) — GPU-accelerated
- Never animate: `width`, `height`, `top`, `left` — use `scaleX`/`scaleY` instead
- Use `layout` prop for elements that change size
- Use `layoutId` for shared element transitions (tab underline, expanding card)

---

## 🧱 Global Components Policy — Build Once, Use Everywhere

Before creating any UI element: *"Will this appear anywhere else in the app?"*

If yes → create in `/components/shared/` → log in `componentsHistory.md`.

### Mandatory Global Components — Always Reuse, Never Rebuild

| Component | File | Purpose |
|-----------|------|---------|
| `DataTable` | `shared/DataTable.tsx` | All tables — campaigns, reports |
| `Pagination` | `shared/Pagination.tsx` | All paginated lists |
| `ResponsiveModal` | `shared/ResponsiveModal.tsx` | All modals (Dialog→Sheet on mobile) |
| `ConfirmDialog` | `shared/ConfirmDialog.tsx` | Disconnect/delete confirmations |
| `PageHeader` | `shared/PageHeader.tsx` | Page title + action slot |
| `EmptyState` | `shared/EmptyState.tsx` | No connectors / no data yet |
| `LoadingSkeleton` | `shared/LoadingSkeleton.tsx` | Matches actual layout shape |
| `SearchInput` | `shared/SearchInput.tsx` | Debounced — campaigns/reports filter |
| `ThemeToggle` | `shared/ThemeToggle.tsx` | Always in header |
| `KpiCard` | `shared/KpiCard.tsx` | All metric summary cards |
| `ConnectorCard` | `shared/ConnectorCard.tsx` | Platform grid cards |
| `SyncStatusBadge` | `shared/SyncStatusBadge.tsx` | connected/syncing/error/disconnected |
| `DateRangePicker` | `shared/DateRangePicker.tsx` | All date filters |

Check `componentsHistory.md` before creating any new component.

---

## 🔄 React Query Rules

### All Server State Through React Query — No Exceptions
```tsx
// ❌ Never
const [data, setData] = useState([])
useEffect(() => { axios.get('/connectors').then(r => setData(r.data)) }, [])

// ✅ Always
const { data, isLoading, error } = useConnectors()
```

### Query Key Convention
```ts
["connectors"]                          // all connectors for user
["connectors", connectorId]             // single connector
["reports", "overview", { from, to }]   // overview KPIs
["reports", "campaigns", { platform }]  // campaign list
["reports", "trend", { metric, period }]// time-series
["reports", "saved"]                    // saved report list
["reports", "saved", reportId]          // single saved report
["sync", "status"]                      // all connector sync statuses
["ai", "history"]                       // AI query history
["auth", "me"]                          // current user profile
```

### Hook File Convention — One File Per Domain
```ts
// hooks/useConnectors.ts
export function useConnectors() { ... }                    // useQuery
export function useConnector(id: string) { ... }           // useQuery
export function useCreateConnector() { ... }               // useMutation
export function useUpdateConnector() { ... }               // useMutation
export function useDeleteConnector() { ... }               // useMutation
export function useTriggerSync(connectorId: string) { ... }// useMutation
```

### Always Handle All Three States
```tsx
if (isLoading) return <LoadingSkeleton variant="table" />
if (error) return <EmptyState title="Failed to load" message={error.message} />
if (!data?.length) return <EmptyState title="No connectors yet" action={<AddConnectorButton />} />
return <DataTable data={data} columns={columns} />
```

### Cache Invalidation on Mutations
```ts
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["connectors"] })
  queryClient.invalidateQueries({ queryKey: ["sync", "status"] })
  toast.success("Connector disconnected")
  onClose()
},
onError: (err: any) => toast.error(err.response?.data?.message ?? err.message),
```

---

## 📝 Forms Rules

- All forms: `react-hook-form` + `zod` — no exceptions
- Validation schema defined outside component as `const schema = z.object({ ... })`
- Submit button shows loading spinner while `isPending` from mutation
- On success: invalidate queries + close modal + `toast.success()`
- On error: `toast.error(err.response?.data?.message ?? err.message)`

```tsx
const schema = z.object({
  platform: z.enum(["google_ads", "ga4", "facebook_ads", "linkedin_ads", "tiktok_ads"]),
  sync_frequency: z.enum(["hourly", "daily", "manual"]),
})

const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
const { mutate, isPending } = useCreateConnector()

function onSubmit(values: z.infer<typeof schema>) {
  mutate(values, {
    onSuccess: () => {
      toast.success("Connector added")
      queryClient.invalidateQueries({ queryKey: ["connectors"] })
      onClose()
      form.reset()
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? err.message),
  })
}
```

---

## 🌐 API Integration

- All calls through `lib/axios.ts` — auto-attaches `Authorization: Bearer <token>`
- Base URL: `http://localhost:8000/api/v1/` (backend FastAPI)
- Never hardcode full URLs in components — relative paths in hook files only
- Error extraction: `err.response?.data?.message ?? err.message`

### `lib/axios.ts`
```ts
import axios from "axios"
import { useAuthStore } from "@/lib/stores/authStore"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL + "/api/v1",
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

export default api
```

### All API Endpoints
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
POST   /api/v1/auth/logout

GET    /api/v1/connectors
POST   /api/v1/connectors
GET    /api/v1/connectors/:id
PUT    /api/v1/connectors/:id
DELETE /api/v1/connectors/:id
GET    /api/v1/connectors/:platform/auth         ← OAuth start
GET    /api/v1/connectors/:platform/callback     ← OAuth callback

POST   /api/v1/sync/trigger/:connector_id
GET    /api/v1/sync/status
GET    /api/v1/sync/history/:connector_id

GET    /api/v1/reports/overview
GET    /api/v1/reports/campaigns
GET    /api/v1/reports/trend
POST   /api/v1/reports/custom
GET    /api/v1/reports/saved
POST   /api/v1/reports/saved
GET    /api/v1/reports/saved/:id
DELETE /api/v1/reports/saved/:id
GET    /api/v1/reports/export

POST   /api/v1/ai/query
GET    /api/v1/ai/history
```

---

## ✅ Code Quality Standards

### TypeScript
- `strict: true` always — zero `any`
- All props: explicit `interface XProps {}`
- All API response types in `types/` — never inline
- Use `z.infer<typeof schema>` for form value types
- Use `as const` for enums/static arrays

### Component Structure — Internal Order
```tsx
// 1. Imports
// 2. Types / interfaces
// 3. Constants + Zod schemas (outside component — stable references)
// 4. Component function
//    a. Hooks (useQuery, useState, useRef, etc.)
//    b. Derived / computed values
//    c. Event handlers
//    d. Return JSX
// 5. Tightly-coupled sub-components (if small)
```

### Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Types/interfaces: `PascalCase` (prefix `I` for API types: `IConnector`, `IReport`)
- Constants: `UPPER_SNAKE_CASE`

### Package Versions (Pinned)
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
  "recharts": "^3.8.1"
}
```

---

## 📝 File References

| File | Read When |
|------|-----------|
| `frontend/agents.md` | Every frontend task — this file |
| `frontend/mistakes.md` | Before writing similar code to a past bug |
| `frontend/componentsHistory.md` | Before creating any UI component |
| `frontend/apiHistory.md` | Before adding any API call or hook |
| `frontend/features.md` | Before building any feature |
| `frontend/design.md` | Before writing any styles, colours, or animations |
