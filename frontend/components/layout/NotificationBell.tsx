"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, RefreshCw, ServerCrash, Wifi } from "lucide-react";
import { fadeVariants, listItemVariants, listVariants } from "@/lib/animations";
import { useMarkAllRead, useMarkRead, useNotifications } from "@/hooks/useNotifications";
import type { Notification } from "@/types/notification";
import { cn } from "@/lib/utils";

// ── Relative time formatter ───────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Notification icon by type ─────────────────────────────────────────────────
function NotifIcon({ type }: { type: Notification["type"] }) {
  if (type === "sync_success")
    return <Wifi className="size-3.5 shrink-0 text-emerald-500" />;
  if (type === "sync_error")
    return <ServerCrash className="size-3.5 shrink-0 text-destructive" />;
  return <Bell className="size-3.5 shrink-0 text-primary" />;
}

// ── Single notification row ───────────────────────────────────────────────────
function NotifRow({ item }: { item: Notification }) {
  const markRead = useMarkRead();

  return (
    <motion.button
      variants={listItemVariants}
      type="button"
      onClick={() => { if (!item.read) markRead.mutate(item.id); }}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/60 transition-colors",
        !item.read && "bg-primary/5"
      )}
    >
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <NotifIcon type={item.type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs font-medium truncate", !item.read ? "text-foreground" : "text-muted-foreground")}>
          {item.title}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{item.message}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">{timeAgo(item.created_at)}</p>
      </div>
      {!item.read && (
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
      )}
    </motion.button>
  );
}

// ── Main bell component ───────────────────────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useNotifications(20);
  const markAll = useMarkAllRead();

  const unread = data?.unread_count ?? 0;
  const items  = data?.items ?? [];

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Notifications"
      >
        <Bell className="size-4" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-0.5 -top-0.5 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="dropdown"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-card shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <p className="text-xs font-semibold">
                Notifications
                {unread > 0 && (
                  <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {unread} new
                  </span>
                )}
              </p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="size-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Body */}
            <div className="max-h-80 overflow-y-auto">
              {isLoading && (
                <div className="flex h-24 items-center justify-center">
                  <RefreshCw className="size-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoading && items.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <Bell className="size-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No notifications yet</p>
                </div>
              )}

              {!isLoading && items.length > 0 && (
                <motion.div
                  variants={listVariants}
                  initial="initial"
                  animate="animate"
                  className="divide-y divide-border"
                >
                  {items.map((item) => (
                    <NotifRow key={item.id} item={item} />
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
