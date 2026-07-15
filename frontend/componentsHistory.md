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
