"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Database, Sparkles } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fadeVariants, listItemVariants, listVariants } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { AiQueryResponse } from "@/types/ai";

// ── Colours ───────────────────────────────────────────────────────────────────
const COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#10b981",
  "#f43f5e", "#8b5cf6", "#3b82f6", "#ec4899",
];

// ── Number formatter ──────────────────────────────────────────────────────────
function fmtNum(v: unknown): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) < 10) return n.toFixed(2);
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

// ── Data-shape detector ───────────────────────────────────────────────────────
type ChartShape = "line" | "bar" | "none";

function detectShape(rows: Record<string, unknown>[]): {
  shape: ChartShape;
  xKey: string;
  yKey: string;
} {
  if (!rows.length) return { shape: "none", xKey: "", yKey: "" };

  const keys = Object.keys(rows[0]);

  // Numeric fields (potential y-axis)
  const numericKeys = keys.filter((k) => {
    const v = rows[0][k];
    return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)));
  });
  const yKey = numericKeys[0] ?? "";

  // Date-like field → line chart
  const dateKey = keys.find(
    (k) =>
      k === "date" ||
      k === "_id" && typeof rows[0][k] === "string" && /^\d{4}-\d{2}/.test(String(rows[0][k]))
  );
  if (dateKey && yKey) return { shape: "line", xKey: dateKey, yKey };

  // Categorical field → bar chart
  const catKey = keys.find(
    (k) => typeof rows[0][k] === "string" && !numericKeys.includes(k)
  );
  if (catKey && yKey) return { shape: "bar", xKey: catKey, yKey };

  return { shape: "none", xKey: "", yKey: "" };
}

// ── Auto chart ────────────────────────────────────────────────────────────────
function AutoChart({ rows }: { rows: Record<string, unknown>[] }) {
  const { shape, xKey, yKey } = detectShape(rows);

  if (shape === "none") return null;

  const data = rows.slice(0, 30).map((r) => ({
    x: String(r[xKey] ?? ""),
    y: Number(r[yKey] ?? 0),
  }));

  if (shape === "line") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ai-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS[0]} stopOpacity={0.18} />
              <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtNum}
            width={44}
          />
          <Tooltip
            formatter={(v: unknown) => [fmtNum(v), yKey]}
            contentStyle={{ fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="y"
            stroke={COLORS[0]}
            strokeWidth={2}
            fill="url(#ai-grad)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Bar chart
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtNum}
        />
        <YAxis
          type="category"
          dataKey="x"
          width={100}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => (v?.length > 14 ? v.slice(0, 14) + "…" : v)}
        />
        <Tooltip
          formatter={(v: unknown) => [fmtNum(v), yKey]}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="y" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Result table ──────────────────────────────────────────────────────────────
function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            {cols.map((c) => (
              <th
                key={c}
                className="px-3 py-2 text-left font-semibold capitalize text-muted-foreground"
              >
                {c === "_id" ? "group" : c}
              </th>
            ))}
          </tr>
        </thead>
        <motion.tbody
          variants={listVariants}
          initial="initial"
          animate="animate"
        >
          {rows.slice(0, 50).map((row, i) => (
            <motion.tr
              key={i}
              variants={listItemVariants}
              className="border-b last:border-0 hover:bg-muted/20"
            >
              {cols.map((c) => (
                <td key={c} className="px-3 py-2 text-foreground/80">
                  {fmtNum(row[c])}
                </td>
              ))}
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
      {rows.length > 50 && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Showing 50 of {rows.length} rows
        </p>
      )}
    </div>
  );
}

// ── Pipeline viewer (collapsible) ─────────────────────────────────────────────
function PipelineViewer({ pipeline }: { pipeline: Record<string, unknown>[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Database className="size-3.5" />
          Generated pipeline ({pipeline.length} stage{pipeline.length !== 1 ? "s" : ""})
        </span>
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="pipeline"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <pre className="overflow-x-auto border-t bg-muted/30 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify(pipeline, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface AiResultCardProps {
  result: AiQueryResponse;
  className?: string;
}

export function AiResultCard({ result, className }: AiResultCardProps) {
  const hasChart = detectShape(result.result).shape !== "none";

  return (
    <motion.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn("space-y-4", className)}
    >
      {/* Question */}
      <div className="rounded-xl border bg-primary/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70 mb-1">
          Question
        </p>
        <p className="text-sm font-medium text-foreground">{result.question}</p>
      </div>

      {/* Explanation */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Claude's answer
        </div>
        <p className="text-sm leading-relaxed text-foreground">{result.explanation}</p>
      </div>

      {/* Chart */}
      {hasChart && result.result.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Visualisation
          </p>
          <AutoChart rows={result.result} />
        </div>
      )}

      {/* Data table */}
      {result.result.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Data ({result.result.length} row{result.result.length !== 1 ? "s" : ""})
          </p>
          <ResultTable rows={result.result} />
        </div>
      )}

      {result.result.length === 0 && (
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No data returned for this query
        </div>
      )}

      {/* Pipeline */}
      <PipelineViewer pipeline={result.pipeline} />
    </motion.div>
  );
}
