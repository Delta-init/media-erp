# Frontend Mistakes Log

> Every bug or wrong pattern found during development goes here.
> Read this before writing any similar code.
> Format: **Date · Feature · Bug · Root Cause · Fix · How to Avoid**

---

## How to use

Before writing a component or hook, scan for patterns matching what you're about to do.
If a mistake is listed, do NOT repeat it.

---

## Log

### 2026-05-05 · Feature 1.14 · `middleware.ts` deprecated in Next.js 16
- **Bug:** `middleware.ts` / `export function middleware()` caused a deprecation warning and did not run correctly.
- **Root Cause:** Next.js 16 renamed the file convention from `middleware` to `proxy`. The exported function must also be named `proxy`.
- **Fix:** Delete `middleware.ts`, create `proxy.ts` with `export function proxy(request: NextRequest)`.
- **How to Avoid:** In this project use `proxy.ts` at the repo root. Never create `middleware.ts`.

### 2026-05-05 · Feature 1.11 · Axios 401 interceptor fires on wrong-credentials login
- **Bug:** After a successful registration, attempting to log in with wrong credentials redirected to `/login` instead of showing an error toast.
- **Root Cause:** The 401 interceptor guard checked `localStorage.getItem("access_token")` — which is truthy after registration — so any 401 (including expected wrong-credentials responses from `/auth/login`) triggered the session-expiry redirect.
- **Fix:** Added `!isAuthEndpoint` check using `/\/auth\/(login|register)/.test(url)`. Auth-endpoint 401s are now passed through to the mutation's `onError` handler.
- **How to Avoid:** When guarding a 401 interceptor redirect, always exclude endpoints that legitimately return 401 as part of their normal contract (login, register).

---
