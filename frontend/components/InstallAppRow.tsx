"use client";

/**
 * Always-available "Install app" entry point for the sidebar.
 *
 * The auto-banner (PWAInstallPrompt) only appears when Chromium fires
 * `beforeinstallprompt`, or on iOS. That leaves users on Firefox, desktop
 * Safari, or a Chromium session where the event already fired/was dismissed
 * with no way to install. This row is always present (until installed) and
 * opens a dialog that either triggers the native prompt or shows the exact
 * steps for the user's browser — so every device has a path to install.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X, Check, AlertTriangle } from "lucide-react";
import {
  detectPlatform,
  getInstallGuide,
  getInstallBlockers,
  isStandalone,
  type InstallPlatform,
} from "@/lib/pwa";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppRow({ collapsed = false }: { collapsed?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [blockers, setBlockers] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setInstalled(isStandalone());
    setPlatform(detectPlatform());
    setBlockers(getInstallBlockers());

    const g = window as unknown as { __pwaPrompt?: BeforeInstallPromptEvent | null };
    const sync = () => setDeferred(g.__pwaPrompt ?? null);
    sync();

    const onInstallable = () => sync();
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      g.__pwaPrompt = e as BeforeInstallPromptEvent;
      sync();
    };
    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
    };

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

  // Nothing to do once it's installed.
  if (!mounted || installed) return null;

  const guide = getInstallGuide(platform, !!deferred);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setOpen(false);
  }

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl"
            >
              <div className="flex items-start gap-3 border-b p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl border" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold">Install mediaERP</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{guide.label}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="space-y-3 p-5">
                {guide.steps.length > 0 && (
                  <ol className="space-y-2">
                    {guide.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-foreground/80">{s}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {guide.canNativePrompt && (
                  <button
                    onClick={install}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Download className="size-4" /> Install app
                  </button>
                )}

                {blockers.length > 0 && (
                  <div className="space-y-1.5 rounded-lg border border-amber-400/30 bg-amber-500/5 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="size-3" /> Can’t install yet
                    </p>
                    {blockers.map((b, i) => (
                      <p key={i} className="text-xs leading-relaxed text-foreground/70">
                        {b}
                      </p>
                    ))}
                  </div>
                )}

                {guide.unsupported && blockers.length === 0 && (
                  <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Tip: installed apps get their own window, an app icon, and work offline.
                  </p>
                )}

                {!guide.canNativePrompt && !guide.unsupported && (
                  <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <Check className="mt-0.5 size-3 shrink-0 text-green-600" />
                    Once added, mediaERP opens in its own window and works offline.
                  </p>
                )}
              </div>
            </motion.div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Install app"
        className={cn(
          "flex w-full items-center rounded-xl px-3 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
          collapsed ? "justify-center" : "gap-3"
        )}
      >
        <Download className="size-4 shrink-0" />
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              key="install-label"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden whitespace-nowrap"
            >
              Install app
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      {/* NOTE: never wrap this in <AnimatePresence> — it filters children with
          isValidElement(), which is false for a portal, so the dialog silently
          never renders. The motion.div inside handles the enter animation. */}
      {dialog}
    </>
  );
}
