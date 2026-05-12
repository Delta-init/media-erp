"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Platform colours ──────────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  google_ads:   "#4285F4",
  facebook_ads: "#1877F2",
  ga4:          "#FF6D00",
  linkedin_ads: "#0A66C2",
  tiktok_ads:   "#010101",
};

const FALLBACK_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899",
  "#8b5cf6", "#14b8a6", "#f97316",
];

function colorFor(platform: string, idx: number) {
  return PLATFORM_COLORS[platform] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function fmtLabel(p: string) {
  return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({
  active, payload, metric,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { pct: number } }[];
  metric: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const fmtVal =
    metric === "spend" || metric === "revenue"
      ? `$${item.value.toLocaleString()}`
      : item.value.toLocaleString();
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium">{fmtLabel(item.name)}</p>
      <p className="text-muted-foreground">
        {fmtVal} ({item.payload.pct.toFixed(1)}%)
      </p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface PlatformData {
  platform: string;
  value: number;
}

interface PlatformDonutProps {
  data: PlatformData[];
  metric?: string;
  loading?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PlatformDonut({ data, metric = "spend", loading, className }: PlatformDonutProps) {
  if (loading) {
    return <div className={cn("h-56 animate-pulse rounded-xl bg-muted", className)} />;
  }

  if (!data.length) {
    return (
      <div className={cn("flex h-56 items-center justify-center text-sm text-muted-foreground", className)}>
        No data
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const chartData = data.map((d) => ({
    name: d.platform,
    value: d.value,
    pct: total ? (d.value / total) * 100 : 0,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
    >
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, idx) => (
              <Cell
                key={entry.name}
                fill={colorFor(entry.name, idx)}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Legend
            formatter={(v) => (
              <span className="text-xs text-muted-foreground">{fmtLabel(v)}</span>
            )}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
