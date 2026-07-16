"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so the app is installable (PWA) and works
 * offline for previously-visited pages. Runs in production only — a SW in dev
 * would fight Next's HMR and serve stale bundles.
 */
export default function PWARegister() {
  // Capture the PWA install event globally, on every page, as early as the app
  // hydrates — well before `beforeinstallprompt` ever fires (it needs load + SW
  // + engagement). The install popup (mounted only inside the dashboard) then
  // reads `window.__pwaPrompt` / listens for the `pwa-installable` event, so it
  // never misses the event even if it fires on the login page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __pwaPrompt?: Event | null };
    const onPrompt = (e: Event) => {
      e.preventDefault();
      w.__pwaPrompt = e;
      window.dispatchEvent(new Event("pwa-installable"));
    };
    const onInstalled = () => {
      w.__pwaPrompt = null;
      window.dispatchEvent(new Event("pwa-installed"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Register the service worker.
  //
  // Production always registers. In dev it is off by default (a SW fights
  // Next's HMR and serves stale bundles), but can be opted into with
  // NEXT_PUBLIC_ENABLE_SW=1 — needed to test installability on a phone via an
  // HTTPS tunnel (ngrok/Cloudflare), since `next dev` is otherwise never
  // installable. Note: a plain-http LAN IP can never install — browsers only
  // expose `serviceWorker` on https:// or localhost.
  useEffect(() => {
    const swEnabled =
      process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "1";
    if (!swEnabled) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Registration failures are non-fatal — the app still works online.
        console.warn("SW registration failed:", err);
      });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);

    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
