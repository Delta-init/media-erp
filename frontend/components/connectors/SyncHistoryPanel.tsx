"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { listVariants, listItemVariants } from "@/lib/animations";
import { useSyncHistory } from "@/hooks/useSync";
import type { SyncRun } from "@/types/sync";

// ── Run row ───────────────────────────────────────────────────────────────────

function RunIcon({ status }: { status: SyncRun["status"] }) {
  if (status === "success")
    return <CheckCircle2 className="size-4 shrink-0 text-green-500" />;
  if (status === "error")
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
    >
      <Loader2 className="size-4 shrink-0 text-blue-500" />
    </motion.span>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RunRow({ run }: { run: SyncRun }) {
  return (
    <motion.li
      variants={listItemVariants}
      className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
    >
      <RunIcon status={run.status} />
      <div className="min-w-0 flex-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium capitalize">{run.status}</span>
          <span className="text-muted-foreground tabular-nums">
            {fmt(run.started_at)}
          </span>
        </div>
        {run.status === "success" && (
          <p className="text-muted-foreground">
            {run.records_synced.toLocaleString()} records synced
          </p>
        )}
        {run.status === "error" && run.error && (
          <p className="truncate text-destructive" title={run.error}>
            {run.error}
          </p>
        )}
        {run.status === "running" && (
          <p className="text-muted-foreground">Sync in progress…</p>
        )}
      </div>
    </motion.li>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectorId: string;
  connectorName: string;
}

export function SyncHistoryPanel({
  open,
  onOpenChange,
  connectorId,
  connectorName,
}: Props) {
  const { data, isLoading } = useSyncHistory(connectorId, open);
  const runs = data?.runs ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync history</DialogTitle>
          <p className="text-xs text-muted-foreground">{connectorName}</p>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading…
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Clock className="size-8 opacity-40" />
              <p className="text-sm">No sync runs yet</p>
              <p className="text-xs">Trigger a sync to see history here.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <motion.ul
                variants={listVariants}
                initial="initial"
                animate="animate"
                className="space-y-2"
              >
                {runs.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
              </motion.ul>
            </AnimatePresence>
          )}
        </div>

        {data && data.total > 20 && (
          <p className="text-center text-xs text-muted-foreground">
            Showing 20 of {data.total} runs
          </p>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
