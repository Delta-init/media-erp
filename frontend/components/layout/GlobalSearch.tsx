"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Cable,
  Kanban,
  LayoutDashboard,
  MessageCircle,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

const ALL_ITEMS = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "dashboard",
    keywords: ["home", "overview", "summary"],
  },
  {
    label: "Connectors",
    href: "/connectors",
    icon: Cable,
    module: "connectors",
    keywords: ["connections", "integrations", "facebook", "google", "meta", "instagram"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: TrendingUp,
    module: "reports",
    keywords: ["analytics", "data", "charts", "graphs"],
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: Target,
    module: "campaigns",
    keywords: ["ads", "marketing", "advertising"],
  },
  {
    label: "Projects",
    href: "/projects",
    icon: Kanban,
    module: "projects",
    keywords: ["tasks", "board", "kanban", "work"],
  },
  {
    label: "AI Queries",
    href: "/ai",
    icon: Sparkles,
    module: "ai",
    keywords: ["ai", "natural language", "query", "nlq", "ask", "intelligence"],
  },
  {
    label: "Publish",
    href: "/social",
    icon: Share2,
    keywords: ["social", "post", "publish", "content"],
  },
  {
    label: "Send DM",
    href: "/social/dm",
    icon: Send,
    keywords: ["dm", "direct message", "message", "inbox"],
  },
  {
    label: "Chat",
    href: "/chat",
    icon: MessageCircle,
    keywords: ["chat", "message", "team", "conversation"],
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    module: "users",
    keywords: ["team", "members", "people", "accounts"],
  },
  {
    label: "Roles",
    href: "/roles",
    icon: ShieldCheck,
    module: "roles",
    keywords: ["permissions", "access", "security", "authorization"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    module: "settings",
    keywords: ["preferences", "config", "account", "profile"],
  },
];

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visibleItems = ALL_ITEMS.filter(
    (item) => !item.module || hasPermission(item.module, "view")
  );

  const q = query.toLowerCase().trim();
  const filtered = q
    ? visibleItems.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.includes(q))
      )
    : visibleItems;

  // Reset active index when query or open state changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Focus input and clear query when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) navigate(filtered[activeIndex].href);
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            key="search-palette"
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed left-1/2 top-[14%] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            {/* Input row */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results list */}
            <div ref={listRef} className="max-h-72 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No pages found for &ldquo;{query}&rdquo;
                </p>
              ) : (
                filtered.map((item, i) => {
                  const Icon = item.icon;
                  const isActive = i === activeIndex;
                  return (
                    <button
                      key={item.href}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center gap-4 border-t border-border px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">↵</kbd>
                open
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">ESC</kbd>
                close
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
