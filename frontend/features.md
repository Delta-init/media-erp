# Frontend Features Log

> Every frontend feature (page, component set, hook set) ever built.
> Read this before building any feature — it may already exist.

---

## Completed Features

### 1.4 — Frontend bootstrap
- **Packages:** framer-motion 11, TanStack RQ 5, Zustand 5, RHF, Zod, Axios, Sonner, Lucide, Recharts, next-themes, shadcn/ui
- **Files:** `lib/axios.ts` (bearer + 401 interceptors), `lib/animations.ts` (6 variant sets), `app/layout.tsx` (DM Sans)

### 1.5 — Frontend providers
- **Files:** `providers/QueryProvider.tsx`, `providers/ThemeProvider.tsx`
- **Wired in:** `app/layout.tsx` — ThemeProvider > QueryProvider > {children}, `<Toaster richColors />`

---

### 1.11 — Auth store + hooks
- **Files:** `types/user.ts` (User, AuthResponse), `stores/authStore.ts` (Zustand persist — user + isAuthenticated), `hooks/useAuth.ts` (useLogin, useRegister, useLogout, useMe)
- **Auth flow:** `setAuth` writes to localStorage + cookie (`access_token`); `clearAuth` removes both. Cookie enables SSR route protection in `proxy.ts`.

### 1.12 — Shared UI primitives
- **Files:** `components/shared/ThemeToggle.tsx`, `PageHeader.tsx`, `LoadingSkeleton.tsx`, `EmptyState.tsx`

### 1.13 — Login & Register pages
- **Files:** `app/(auth)/layout.tsx` (centered, ThemeToggle top-right), `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`
- **Stack:** RHF + `zodResolver` + Framer Motion `pageVariants`

### 1.14 — Route guard
- **Files:** `proxy.ts` (Next.js 16 file — NOT `middleware.ts`), `app/(dashboard)/layout.tsx` (client-side hydration check)
- **Pattern:** `proxy.ts` checks `access_token` cookie → redirects to `/login?from=<path>` if absent. Layout does secondary client-side check after Zustand rehydrates.

## Upcoming

| Feature | Description | Status |
|---------|-------------|--------|
| 2.7 | Connector types + hooks | ⬜ |
| 5.1 | App layout shell | ⬜ |
| 5.2 | Overview page | ⬜ |

---
