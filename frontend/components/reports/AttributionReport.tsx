"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, TrendingUp, GitMerge } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { useAttribution, type AttributionModel } from "@/hooks/useAttribution";

// ── Helpers ───────────────────────────────────────────────────────────────────

function today()        { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
}

function platformLabel(p: string) {
  return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MODEL_OPTIONS: { id: AttributionModel; label: string; desc: string }[] = [
  { id: "first_touch", label: "First Touch",  desc: "100% credit to the first platform in the date range" },
  { id: "last_touch",  label: "Last Touch",   desc: "100% credit to the last platform before conversion" },
  { id: "linear",      label: "Linear",       desc: "Equal credit split across all active platforms" },
  { id: "time_decay",  label: "Time Decay",   desc: "Exponential credit bias toward more recent platforms (½-life 7 d)" },
];

const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

// ── Component ─────────────────────────────────────────────────────────────────

export function AttributionReport() {
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo,   setDateTo]   = useState(today());
  const [model, setModel]       = useState<AttributionModel>("linear");

  const { data, isLoading, isError } = useAttribution(dateFrom, dateTo, model);

  const chartData = (data?.platforms ?? []).map((p, i) => ({
    name:   platformLabel(p.platform),
    weight: p.weight_pct,
    color:  PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="space-y-5">
      {/* Date range */}
      <DateRangePicker
        dateFrom={dateFrom}
        dateTo={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
      />

      {/* Model selector */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MODEL_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setModel(opt.id)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              model === opt.id
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-muted-foreground/40"
            )}
          >
            <p className={cn(
              "text-sm font-semibold",
              model === opt.id ? "text-primary" : "text-foreground"
            )}>
              {opt.label}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
              {opt.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Computing attribution…
        </div>
      )}

      {isError && (
        <div className="flex h-48 items-center justify-center text-sm text-destructive">
          Failed to compute attribution. Please try again.
        </div>
      )}

      {data && !isLoading && (
        <motion.div
          key={model}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-5"
        >
          {/* Summary strip */}
          <div className="grid gap-3 sm:grid-cols-2 rounded-xl border bg-card p-4">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Conversions</p>
              <p className="text-2xl font-bold text-foreground">{data.total_conversions.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total Revenue</p>
              <p className="text-2xl font-bold text-foreground">${data.total_revenue.toLocaleString()}</p>
            </div>
          </div>

          {data.platforms.length === 0 && (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No platform data for this date range
            </div>
          )}

          {data.platforms.length > 0 && (
            <>
              {/* Bar chart — attribution weight */}
              <div className="rounded-xl border bg-card p-5">
                <p className="mb-4 text-sm font-medium">Attribution weight by platform</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip
                      formatter={(v) => [typeof v === "number" ? `${v.toFixed(1)}%` : "—", "Weight"]}
                      contentStyle={{ borderRadius: 12, fontSize: 12 }}
                    />
                    <Bar dataKey="weight" radius={[0, 6, 6, 0]} maxBarSize={28}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Detail table */}
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {["Platform", "Weight", "Conv.", "Revenue", "Spend", "ROAS", "CTR", "CPC"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.platforms.map((p, i) => (
                      <tr key={p.platform} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2 text-xs font-medium">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ background: PALETTE[i % PALETTE.length] }}
                            />
                            {platformLabel(p.platform)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-primary">{p.weight_pct}%</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.attributed_conversions.toLocaleString()}</td>
                        <td className="px-4 py-2.5 tabular-nums">${p.attributed_revenue.toLocaleString()}</td>
                        <td className="px-4 py-2.5 tabular-nums">${p.spend.toLocaleString()}</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.roas.toFixed(2)}×</td>
                        <td className="px-4 py-2.5 tabular-nums">{p.ctr.toFixed(2)}%</td>
                        <td className="px-4 py-2.5 tabular-nums">${p.cpc.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
