"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { CampaignRow } from "@/types/report";

// ── Metric options ────────────────────────────────────────────────────────────
type BarMetric = "spend" | "clicks" | "impressions" | "conversions" | "revenue" | "roas";

const COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6",
  "#14b8a6", "#f97316", "#ef4444", "#84cc16",
];

function fmtVal(metric: BarMetric, v: number): string {
  if (metric === "spend" || metric === "revenue") return `$${v.toLocaleString()}`;
  if (metric === "roas") return `${v.toFixed(2)}×`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return v.toLocaleString();
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({
  active, payload, metric,
}: {
  active?: boolean;
  payload?: { value: number; payload: { campaign_name: string } }[];
  metric: BarMetric;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="max-w-[200px] rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="truncate font-medium">{item.payload.campaign_name}</p>
      <p className="text-muted-foreground">{fmtVal(metric, item.value)}</p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface CampaignBarChartProps {
  rows: CampaignRow[];
  metric?: BarMetric;
  topN?: number;
  loading?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CampaignBarChart({
  rows,
  metric = "spend",
  topN = 8,
  loading,
  className,
}: CampaignBarChartProps) {
  if (loading) {
    return <div className={cn("h-56 animate-pulse rounded-xl bg-muted", className)} />;
  }

  if (!rows.length) {
    return (
      <div className={cn("flex h-56 items-center justify-center text-sm text-muted-foreground", className)}>
        No campaigns to display
      </div>
    );
  }

  const chartData = [...rows]
    .sort((a, b) => (b[metric] as number) - (a[metric] as number))
    .slice(0, topN)
    .map((r) => ({
      campaign_name: r.campaign_name.length > 18 ? r.campaign_name.slice(0, 18) + "…" : r.campaign_name,
      value: r[metric] as number,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
    >
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
          <XAxis
            type="number"
            tickFormatter={(v) => fmtVal(metric, v)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <YAxis
            type="category"
            dataKey="campaign_name"
            width={130}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
