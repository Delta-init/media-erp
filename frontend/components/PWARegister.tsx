"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so the app is installable (PWA) and works
 * offline for previously-visited pages. Runs in production only — a SW in dev
 * would fight Next's HMR and serve stale bundles.
 */
export default function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
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
