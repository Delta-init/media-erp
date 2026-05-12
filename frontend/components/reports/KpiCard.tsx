"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { kpiCardVariants } from "@/lib/animations";
import type { KpiValue } from "@/types/report";

// ── Value formatters ──────────────────────────────────────────────────────────
function formatValue(metric: string, value: number | null): string {
  if (value === null || value === undefined) return "—";
  switch (metric) {
    case "spend":
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    case "impressions":
    case "clicks":
    case "conversions":
      return value >= 1_000_000
        ? `${(value / 1_000_000).toFixed(1)}M`
        : value >= 1_000
        ? `${(value / 1_000).toFixed(1)}K`
        : String(value);
    case "revenue":
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    case "ctr":
      return `${value.toFixed(2)}%`;
    case "cpc":
      return `$${value.toFixed(2)}`;
    case "roas":
      return `${value.toFixed(2)}×`;
    default:
      return value.toLocaleString();
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface KpiCardProps {
  metric: string;
  label: string;
  icon: LucideIcon;
  color: string;   // Tailwind text colour, e.g. "text-blue-500"
  bg: string;      // Tailwind bg colour,   e.g. "bg-blue-500/10"
  data: KpiValue | undefined;
  loading?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function KpiCard({ metric, label, icon: Icon, color, bg, data, loading }: KpiCardProps) {
  const value  = data?.value  ?? null;
  const delta  = data?.delta  ?? null;
  const isUp   = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;

  return (
    <motion.div
      variants={kpiCardVariants}
      whileHover={{ y: -3, boxShadow: "0 12px 32px -8px rgb(0 0 0 / 0.14)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn("flex size-8 items-center justify-center rounded-lg", bg)}>
          <Icon className={cn("size-4", color)} />
        </div>
      </div>

      {/* Value */}
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold tracking-tight">
            {formatValue(metric, value)}
          </p>

          {/* Delta */}
          <p className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            isUp   ? "text-emerald-500" :
            isDown ? "text-destructive"  :
                     "text-muted-foreground"
          )}>
            {isUp   && <TrendingUp   className="size-3" />}
            {isDown && <TrendingDown  className="size-3" />}
            {!isUp && !isDown && <Minus className="size-3" />}

            {delta !== null
              ? `${isUp ? "+" : ""}${delta.toFixed(1)}% vs prev period`
              : "No prior data"}
          </p>
        </div>
      )}
    </motion.div>
  );
}
