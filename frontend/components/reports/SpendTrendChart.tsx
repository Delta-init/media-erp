"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { TrendPoint, ReportMetric } from "@/types/report";
import { fmtDateOnly } from "@/lib/datetime";

// ── Label & formatter per metric ─────────────────────────────────────────────
const META: Record<ReportMetric, { label: string; format: (v: number) => string; color: string }> = {
  spend:       { label: "Spend",       format: (v) => `$${v.toLocaleString()}`,     color: "#6366f1" },
  clicks:      { label: "Clicks",      format: (v) => v.toLocaleString(),            color: "#0ea5e9" },
  impressions: { label: "Impressions", format: (v) => v.toLocaleString(),            color: "#8b5cf6" },
  conversions: { label: "Conversions", format: (v) => v.toLocaleString(),            color: "#10b981" },
  revenue:     { label: "Revenue",     format: (v) => `$${v.toLocaleString()}`,     color: "#f59e0b" },
  ctr:         { label: "CTR",         format: (v) => `${v.toFixed(2)}%`,           color: "#ec4899" },
  cpc:         { label: "CPC",         format: (v) => `$${v.toFixed(2)}`,           color: "#14b8a6" },
  roas:        { label: "ROAS",        format: (v) => `${v.toFixed(2)}×`,           color: "#f97316" },
};

// ── Compact Y-axis tick formatter ─────────────────────────────────────────────
function yTick(metric: ReportMetric) {
  return (v: number) => {
    if (["spend", "revenue"].includes(metric)) {
      if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
      return `$${v}`;
    }
    if (metric === "ctr")  return `${v.toFixed(1)}%`;
    if (metric === "cpc")  return `$${v.toFixed(2)}`;
    if (metric === "roas") return `${v.toFixed(1)}×`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
    return String(v);
  };
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({
  active, payload, label, metric,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  metric: ReportMetric;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">
        {META[metric]?.label}: <span className="font-semibold text-foreground">{val !== undefined ? META[metric]?.format(val) : "—"}</span>
      </p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface SpendTrendChartProps {
  data: TrendPoint[];
  metric: ReportMetric;
  loading?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SpendTrendChart({ data, metric, loading, className }: SpendTrendChartProps) {
  const meta = META[metric];

  if (loading) {
    return (
      <div className={cn("h-56 animate-pulse rounded-xl bg-muted", className)} />
    );
  }

  if (!data.length) {
    return (
      <div className={cn("flex h-56 items-center justify-center text-sm text-muted-foreground", className)}>
        No data for this period
      </div>
    );
  }

  // Shorten date labels
  const formatted = data.map((d) => ({
    ...d,
    label: d.date.length === 10
      ? fmtDateOnly(d.date, { month: "short", day: "numeric" })
      : d.date,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={meta.color} stopOpacity={0.18} />
              <stop offset="95%" stopColor={meta.color} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={yTick(metric)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            width={52}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={meta.color}
            strokeWidth={2}
            fill={`url(#grad-${metric})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
