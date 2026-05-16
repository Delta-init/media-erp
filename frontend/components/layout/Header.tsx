"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { useLogout } from "@/hooks/useAuth";
import { headerVariants } from "@/lib/animations";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard":  "Overview",
  "/connectors": "Connectors",
  "/reports":    "Reports",
  "/campaigns":  "Campaigns",
  "/projects":   "Projects",
  "/ai":         "AI Queries",
  "/chat":       "Chat",
  "/users":      "Users",
  "/roles":      "Roles",
  "/settings":   "Settings",
};

function getPageLabel(pathname: string): string {
  for (const [key, label] of Object.entries(ROUTE_LABELS)) {
    if (pathname === key || (key !== "/dashboard" && pathname.startsWith(key))) {
      return label;
    }
  }
  return "mediaERP";
}

export function Header() {
  const { setMobileOpen } = useUiStore();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const pathname = usePathname();
  const pageLabel = getPageLabel(pathname);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <>
    <motion.header
      variants={headerVariants}
      initial="initial"
      animate="animate"
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md"
    >
      {/* Mobile menu toggle */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setMobileOpen(true)}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors lg:hidden"
      >
        <Menu className="size-4" />
      </motion.button>

      {/* Page title */}
      <motion.h1
        key={pageLabel}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="text-sm font-semibold text-foreground"
      >
        {pageLabel}
      </motion.h1>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-1">
        {/* Search button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setSearchOpen(true)}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Search (Ctrl+K)"
        >
          <Search className="size-4" />
        </motion.button>

        {/* Notifications */}
        <NotificationBell />

        {/* Avatar */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => logout.mutate()}
          title={`Signed in as ${user?.email ?? ""}\nClick to sign out`}
          className="ml-1 flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
        >
          {initials}
        </motion.button>
      </div>
    </motion.header>

    <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
