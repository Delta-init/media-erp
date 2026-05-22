"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, TrendingUp, TrendingDown, X, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnomalies, type Anomaly } from "@/hooks/useAnomalies";

function platformLabel(p: string) {
  return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  });
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const isSevere = anomaly.severity === "severe";
  const isSpike  = anomaly.direction === "spike";

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-xl border p-3 text-sm",
      isSevere
        ? "border-destructive/30 bg-destructive/5"
        : "border-amber-500/30 bg-amber-500/5"
    )}>
      <span className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
        isSevere ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-600"
      )}>
        {isSpike
          ? <TrendingUp className="size-3.5" />
          : <TrendingDown className="size-3.5" />}
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground leading-snug">
          {platformLabel(anomaly.platform)} · <span className="capitalize">{anomaly.metric}</span>
          {" "}
          <span className={cn(
            "text-xs font-semibold px-1.5 py-0.5 rounded",
            isSevere ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700"
          )}>
            {isSevere ? "Severe" : "Mild"} {anomaly.direction}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {fmtDate(anomaly.date)} · Value: <strong>{anomaly.value.toLocaleString()}</strong>
          {" vs "}expected {anomaly.expected_mean.toLocaleString()} (±{anomaly.expected_std.toLocaleString()})
          {anomaly.pct_change !== null && (
            <> · <span className={cn(
              "font-semibold",
              anomaly.pct_change > 0 ? "text-emerald-600" : "text-destructive"
            )}>
              {anomaly.pct_change > 0 ? "+" : ""}{anomaly.pct_change}%
            </span></>
          )}
        </p>
      </div>

      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
        z = {anomaly.z_score > 0 ? "+" : ""}{anomaly.z_score}
      </span>
    </div>
  );
}

interface AnomalyPanelProps {
  dateFrom: string;
  dateTo:   string;
}

export function AnomalyPanel({ dateFrom, dateTo }: AnomalyPanelProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded,  setExpanded]  = useState(false);

  const { data, isLoading, refetch, isFetching } = useAnomalies(dateFrom, dateTo);

  if (dismissed || (!isLoading && data?.count === 0)) return null;

  const anomalies = data?.anomalies ?? [];
  const severe    = anomalies.filter((a) => a.severity === "severe").length;
  const shown     = expanded ? anomalies : anomalies.slice(0, 3);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3"
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-foreground flex-1">
            {isLoading ? "Scanning for anomalies…" : (
              <>
                {data!.count} anomal{data!.count === 1 ? "y" : "ies"} detected
                {severe > 0 && (
                  <span className="ml-2 rounded-full bg-destructive px-1.5 py-px text-[10px] font-bold text-destructive-foreground">
                    {severe} severe
                  </span>
                )}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Anomaly cards */}
        {!isLoading && shown.length > 0 && (
          <div className="space-y-2">
            {shown.map((a, i) => <AnomalyCard key={i} anomaly={a} />)}
          </div>
        )}

        {/* Expand toggle */}
        {!isLoading && anomalies.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            {expanded
              ? <><ChevronUp className="size-3.5" /> Show less</>
              : <><ChevronDown className="size-3.5" /> Show {anomalies.length - 3} more anomalies</>}
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
