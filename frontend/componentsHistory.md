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
