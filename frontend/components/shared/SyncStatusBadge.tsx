"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ConnectorStatus } from "@/types/connector";

const CONFIG: Record<ConnectorStatus, { label: string; className: string }> = {
  connected: {
    label: "Connected",
    className: "bg-green-500/15 text-green-700 dark:text-green-400",
  },
  disconnected: {
    label: "Disconnected",
    className: "bg-muted text-muted-foreground",
  },
  syncing: {
    label: "Syncing…",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  error: {
    label: "Error",
    className: "bg-destructive/15 text-destructive",
  },
};

export function SyncStatusBadge({ status }: { status: ConnectorStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.disconnected;
  return (
    <motion.span
      key={status}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        cfg.className
      )}
    >
      {status === "syncing" && (
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="size-1.5 rounded-full bg-current"
        />
      )}
      {cfg.label}
    </motion.span>
  );
}
