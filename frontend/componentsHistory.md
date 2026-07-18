# Frontend Components History

> Every reusable component ever created goes here.
> Read this before building any new component — it may already exist.
> Format: **Feature · File · Component · Props · Purpose**

---

## How to use

1. Before creating a component, search this file by name.
2. If it exists, import it — do NOT create a duplicate.
3. After creating a new component, log it here immediately.

---

## Shared / UI Components

### ThemeToggle
- **Feature:** 1.12
- **File:** `components/shared/ThemeToggle.tsx`
- **Props:** none
- **Purpose:** Sun/Moon button that toggles light/dark via `next-themes`. Renders a 36×36px placeholder until mounted to avoid hydration mismatch.
- **Animations:** none (CSS `transition-colors`)

### PageHeader
- **Feature:** 1.12
- **File:** `components/shared/PageHeader.tsx`
- **Props:** `{ title: string; subtitle?: string; action?: React.ReactNode }`
- **Purpose:** Section heading with optional subtitle and right-aligned action slot.
- **Animations:** none

### LoadingSkeleton
- **Feature:** 1.12
- **File:** `components/shared/LoadingSkeleton.tsx`
- **Props:** `{ lines?: number; className?: string }`
- **Purpose:** Animated pulse skeleton lines. Last line is 3/4 width. Default 3 lines.
- **Animations:** Tailwind `animate-pulse`

### EmptyState
- **Feature:** 1.12
- **File:** `components/shared/EmptyState.tsx`
- **Props:** `{ icon: LucideIcon; title: string; description: string; action?: React.ReactNode }`
- **Purpose:** Centered icon + title + description + optional CTA for empty collections.
- **Animations:** none

---

## Connector Components (Feature 2.8 – 2.11)

### SyncStatusBadge
- **Feature:** 2.8
- **File:** `components/shared/SyncStatusBadge.tsx`
- **Props:** `{ status: ConnectorStatus }`
- **Purpose:** Colored pill badge for connector status (connected/disconnected/syncing/error).
- **Animations:** none

### ConfirmDialog
- **Feature:** 2.8
- **File:** `components/shared/ConfirmDialog.tsx`
- **Props:** `{ open; onOpenChange; title; description; confirmLabel?; onConfirm; loading? }`
- **Purpose:** shadcn Dialog wrapper for destructive confirmations. Renders Cancel + destructive Confirm buttons.
- **Animations:** shadcn Dialog built-in

### ConnectorCard
- **Feature:** 2.8
- **File:** `components/shared/ConnectorCard.tsx`
- **Props:** `{ connector: Connector }`
- **Purpose:** Card showing platform initials, name, status badge, sync frequency, last synced date. Connect button (OAuth) shown when status is disconnected/error. Remove triggers ConfirmDialog.
- **Animations:** none

### AddConnectorModal
- **Feature:** 2.9
- **File:** `components/connectors/AddConnectorModal.tsx`
- **Props:** `{ open: boolean; onOpenChange: (v: boolean) => void }`
- **Purpose:** shadcn Dialog with platform picker grid + name input + sync frequency Select. On submit: creates connector then immediately starts OAuth redirect via `useStartOAuth`.
- **Animations:** shadcn Dialog built-in

### OAuthCallback
- **Feature:** 2.11
- **File:** `components/connectors/OAuthCallback.tsx`
- **Props:** none
- **Purpose:** Client component (renders null). Reads `?connected=` and `?error=` search params on mount, shows toast, invalidates `["connectors"]` query, strips params from URL without navigation.
- **Animations:** none

### ConnectorGrid
- **Feature:** 2.10
- **File:** `components/connectors/ConnectorGrid.tsx`
- **Props:** `{ connectors: Connector[] | undefined; isLoading: boolean; onAdd: () => void }`
- **Purpose:** 1–3 column responsive grid of ConnectorCards. Shows LoadingSkeleton while loading, EmptyState (with icon=Cable) when empty.
- **Animations:** none

---

## Template entry

```
### ComponentName
- **Feature:** X.Y
- **File:** `components/shared/ComponentName.tsx`
- **Props:** `{ propA: type; propB?: type }`
- **Purpose:** One-line description
- **Animations:** which Framer Motion variant it uses
```

---

### ApproveRouteModal (Leader Desk — Approve Task)
- **File:** `app/(dashboard)/leader/page.tsx`
- **Change (2026-07-15):** Removed the "Assign to leader" dropdown. Approval now only asks for "Route to team". The approved copy is created `pending` + unassigned in the destination team, so it surfaces to that team's leader(s) in their Leader Desk *incoming* queue (`/projects/leader/queue`). Dropped `nextLeaderId` state and the `next_leader_id`/`next_leader_name` payload fields (backend still accepts them; no backend change). `useAssignableUsers` import retained — still used by the Reedit modal.

### ReeditModal (Leader Desk — Send to Reedit)
- **File:** `app/(dashboard)/leader/page.tsx`
- **Change (2026-07-15):** Removed the "Assign to leader" dropdown; modal now only asks for a reason. Payload = `{status:"reedit", reedit_reason}`. Dropped `leaderId` state and the `useAssignableUsers` import (no longer used anywhere in this file). Backend now returns a routed reedit to the routing leader's team, so no manual leader-picking is needed here.

### TaskDetailModal — cross-team History + Team Flow (2026-07-15)
- **File:** `components/projects/TaskDetailModal.tsx`
- **Change:** History tab now shows the FULL routing-chain story (aggregated across every task doc in the chain) plus a new **Team Flow ribbon** at the top summarising the journey, e.g. `video → content (reedit) → video → content (approved)`. Each timeline entry now carries a **team label chip** (deterministic per-team colour) so you see who did what in which team. Added `received` action meta ("Received by Team"). `HistoryTimeline` gained a `teamFlow` prop fed from `taskDetail.team_flow`.
- **Types:** `TaskHistoryEntry` gained `team_id`/`team_name`; new `TeamFlowStep`; `Task.team_flow?`.
- **Note:** History tab uses `AnimatePresence mode="wait"`; verified rendering via DOM (the CI/preview pane had a stalled rAF loop that blocks framer exit-animations + screenshots — not a code issue).

### FileUploader (shared) — direct-to-R2 uploads (2026-07-15)
- **File:** `components/shared/FileUploader.tsx` (+ `lib/directUpload.ts`)
- **What:** Reusable controlled uploader (`value: Attachment[]`, `onChange`). Uploads files **directly to Cloudflare R2** via backend-issued pre-signed PUT URLs — bytes never pass through the backend, so up to **1 GB** per file. Drag-and-drop + click, live per-file progress, image/video thumbnails, file-type icons, remove, and click-to-view (opens the public R2 URL in a new tab). `readOnly` mode = view-only gallery. `compact` variant for tight spaces.
- **Migration:** `useUploadAttachments` (useUpload.ts) and `useUploadMedia` (useSocial.ts) now call `uploadFilesDirect` — so **every existing caller** (chat, social, task modals) uploads direct-to-R2 with no code change. `TaskDetailModal` + `AddTaskModal` swapped their bespoke upload UIs for `<FileUploader>` (removed the old `AttachmentList` + upload buttons). No frontend path hits the backend multipart endpoints anymore.
- **Security:** R2 secret keys stay server-side; frontend `.env` holds only `NEXT_PUBLIC_R2_PUBLIC_URL` (public, for viewing).

### lib/datetime.ts — IST-locked date rendering (2026-07-15)
- **File:** `lib/datetime.ts`. mediaERP renders **every** date/time in IST regardless of the viewer's browser timezone.
- **Helpers:** `fmtDateTime`, `fmtDate`, `fmtTime`, `fmtDateTimeIST` (adds an "IST" suffix), `fmtDateOnly`, `istDateKey`, `istTodayKey`, `isSameIstDay`, `isBeforeIstToday`. All force `timeZone: "Asia/Kolkata"` — passed **last** so a caller can't override it.
- **Never** call `toLocaleString()/toLocaleDateString()/toLocaleTimeString()` directly — a bare call uses the browser's timezone. All 36 call sites across 25 files were migrated.
- **`fmtDateOnly` vs `fmtDateTime`:** `task.due_date` and `marketing_data.date` are **date-only** "YYYY-MM-DD" strings, not instants. `new Date("2026-06-17")` parses as UTC midnight and rendered as the *previous day* west of UTC — a real pre-existing bug. Use `fmtDateOnly` for those; never timezone-shift them.
- **`isTaskOverdue`** (types/project.ts) now compares IST date keys instead of `Date#setHours()` (which used the browser's timezone). Chat "Today/Yesterday" grouping likewise uses `istDateKey`.

### AssignCard (Leader Desk › Assign Work) — self-assign feedback (2026-07-15)
- **File:** `app/(dashboard)/leader/page.tsx`
- **Change:** `assign()` was fire-and-forget with **no toast** (unlike `ReeditCard`), so assigning gave zero feedback. Now awaits the mutation, shows `Assigned to you — "<task>"` when the leader assigns to themselves (via `useAuthStore().user.id`) or `Assigned to <name>` otherwise, and resets the dropdown. Combined with the backend `incoming` fix, a self-assigned task now visibly leaves the queue and lands on the leader's own board.

### PWA install — works on all devices/browsers (2026-07-15)
- **New `lib/pwa.ts`** — single source of truth for install support: `isStandalone()`, `isIOS()`, `detectPlatform()`, `getInstallGuide()`, `getInstallBlockers()`.
- **BUG FIXED — iPadOS never got a prompt.** Detection was `/iphone|ipad|ipod/i`, but **iPadOS 13+ reports a "Macintosh" UA**, so iPads fell into the Chromium branch where Safari never fires `beforeinstallprompt` → no prompt at all. Now `isIOS()` also matches `/macintosh/ && navigator.maxTouchPoints > 1` (a real Mac has 0, so it stays non-iOS).
- **New `components/InstallAppRow.tsx`** — an always-available "Install app" row in the sidebar footer (auto-hides once installed). Opens a dialog that fires the **native** prompt when Chromium offers one, otherwise shows exact per-browser steps (Android Chrome / Samsung / Firefox Android / desktop Chromium / macOS Safari / iOS) and honest blockers (e.g. "not served over HTTPS"). This is what makes install reachable on Firefox, Safari, and any session where `beforeinstallprompt` already fired or was dismissed.
- **GOTCHA (cost me a bug):** never wrap a `createPortal(...)` in `<AnimatePresence>` — it filters children through `isValidElement()`, which is **false** for a portal, so the dialog silently never renders. Render the portal directly; animate with the `motion.div` inside.
- `app/layout.tsx` — added legacy `apple-mobile-web-app-capable` (Next 16 only emits the modern `mobile-web-app-capable`; iOS < 16.4 needs the legacy tag or a home-screen launch opens in a browser tab).
- `PWARegister.tsx` — SW still prod-only by default, but now opt-in via `NEXT_PUBLIC_ENABLE_SW=1` so installability can be tested from a phone over an HTTPS tunnel without a prod build.

**Why a phone shows no prompt on the dev server (not a bug):** browsers only expose `navigator.serviceWorker` in a **secure context** — `https://` or `localhost`. A LAN URL like `http://192.168.x.x:3000` can never install. Use the HTTPS deploy or a tunnel.

### KanbanBoard + AddTaskModal — tasks disappearing / creation validation (2026-07-18)
- **BUG: board silently dropped tasks.** `useEffect(... if (!draggingRef.current) setLocalTasks(tasks))`
  skipped server updates that arrived MID-DRAG and never retried, so anything
  created during a drag stayed invisible. Now a missed sync is recorded
  (`pendingSyncRef`) and applied on drag end; the optimistic cross-column update
  re-bases onto the fresh server list instead of discarding it.
- **AddTaskModal validation:** Title, Team, Assigned To and Due Date are all
  required (marked `*`); Create is disabled with a tooltip naming what's missing.
  Mirrors the new server rules.
- **BUG found while adding that validation:** `canAssignOthers` only counted
  Super Admin, so a Coordinator/Admin was forced to self-assign — and the team
  dropdown only listed teams they *belong to*. A Coordinator would have been
  unable to create any task once a team+assignee became mandatory. Both now
  mirror the backend: elevated roles (Super Admin/Admin/Coordinator) can assign
  to anyone and pick any team. "No team (personal)" → "Select a team…".

### Projects — real pagination (2026-07-18)
- **`useTasksPaged(filters, page, limit)`** — flat paged list returning
  `{items, meta}`; `placeholderData` keeps the current page visible while the
  next one loads.
- **`useBoardColumns(filters, pageSize)`** — the Kanban board pages **each
  column independently** via `useQueries`. A flat page-1 slice is just the newest
  N tasks overall, which would fill the six columns unevenly; per-column paging
  is what Jira/Trello do. Each column reports `{total, loaded, hasMore}` and gets
  a "Load more · showing X of Y" button, so a column can never quietly hide work.
- Column badges and the page header now show **server totals**, not just what is
  loaded — the header previously under-reported whenever a list was capped.
- Table view gained a real pager ("Showing 1–25 of 86", Page N of M,
  Previous/Next). Verified paging 1→2 shows 26–50.
- `useTasks()` is left unchanged for any other callers.

### Projects — mobile scrolling & responsive board (2026-07-18)
- **BUG (why "tasks were missing" on phone): every card had `touch-action: none`.**
  `KanbanCard` set it unconditionally for dnd-kit. On a phone the cards cover the
  screen, so nearly every touch began on a card and the browser was told never to
  scroll from it — BOTH axes were dead, so off-screen tasks were unreachable and
  looked missing. The board's TouchSensor uses a *delay* activation constraint,
  so dnd-kit only needs `touch-action: none` **while dragging**; before that the
  user must be free to pan. Now `isDragging ? "none" : "manipulation"`.
  Measured: elements blocking touch **86 → 0**.
- **Responsive board.** A 6-column horizontal strip is unusable at 375px (it was
  1260px wide × 4000px tall). Columns now **stack vertically on phones** and
  become the classic side-by-side board from `md` up. No horizontal trap
  (`horizontalOverflow: false`).
- **Columns now have a definite max-height** (`max-h-[60vh]`,
  `md:max-h-[calc(100vh-23rem)]`). They previously relied on an `h-full` chain;
  when no ancestor had a definite height the columns grew to fit every card and
  the *whole page* scrolled instead of each column scrolling internally. This was
  a pre-existing desktop issue too — page overflow **3114px → 8px**.
- Added `overscroll-behavior: contain` so column scrolling doesn't chain to the
  page, and made the Table view horizontally scrollable on small screens.
