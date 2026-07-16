"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X, Share, Plus } from "lucide-react";
import { detectPlatform, getInstallGuide, isIOS, isStandalone } from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed → never nag.
    if (isStandalone()) return;

    const recentlyDismissed = () => {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return at && Date.now() - at < DISMISS_DAYS * 86_400_000;
    };

    // Safari (iPhone *and* iPadOS) never fires beforeinstallprompt — show the
    // manual Add-to-Home-Screen steps instead. isIOS() also catches iPadOS 13+,
    // which reports a "Macintosh" user-agent.
    if (isIOS()) {
      if (!recentlyDismissed()) {
        setIos(true);
        setShow(true);
      }
      return;
    }

    const g = window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent | null };

    const reveal = () => {
      const evt = g.__pwaPrompt;
      if (!evt) return;
      setDeferred(evt);
      if (!recentlyDismissed()) setShow(true);
    };

    // The event may have already fired (captured early in the root layout)…
    reveal();

    // …or it may fire after mount.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      g.__pwaPrompt = e as BeforeInstallPromptEvent;
      reveal();
    };
    const onInstallable = () => reveal();
    const onInstalled = () => setShow(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("pwa-installable", onInstallable);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("pwa-installed", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("pwa-installable", onInstallable);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("pwa-installed", onInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <div className="flex items-start gap-3 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="mediaERP" className="size-12 shrink-0 rounded-xl border" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Install mediaERP</p>
                {ios ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Tap <Share className="inline size-3.5 align-text-bottom" /> Share, then
                    <span className="mx-1 inline-flex items-center gap-0.5 rounded bg-muted px-1 py-0.5 font-medium text-foreground">
                      <Plus className="size-3" /> Add to Home Screen
                    </span>
                    for quick access &amp; offline use.
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Add it to your home screen for quick access and offline use.
                  </p>
                )}
              </div>
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {!ios && (
              <div className="flex gap-2 border-t bg-muted/20 px-4 py-3">
                <button
                  onClick={dismiss}
                  className="flex-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Not now
                </button>
                <button
                  onClick={install}
                  className="flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Download className="size-4" /> Install app
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Re-exported so callers can reuse the same detection without duplicating it.
export { detectPlatform, getInstallGuide };
