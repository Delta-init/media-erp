"use client";

import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  Eye,
  RefreshCw,
  Tag,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  useCustomReport,
  useDeleteSavedReport,
  useSavedReport,
} from "@/hooks/useReports";
import { fadeVariants } from "@/lib/animations";
import type { ChartType, CustomReportData } from "@/types/report";

// ── helpers ───────────────────────────────────────────────────────────────────
const CHART_COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#10b981",
  "#f43f5e", "#8b5cf6", "#3b82f6", "#ec4899",
];

function fmtNum(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n % 1 === 0 ? n.toString() : n.toFixed(2);
}

const CHART_ICON: Record<ChartType, React.ElementType> = {
  line: TrendingUp, bar: BarChart2, donut: Eye, table: BarChart2,
};

// ── Result renderer ───────────────────────────────────────────────────────────
function ResultView({ result }: { result: CustomReportData }) {
  const { data, metrics, dimensions, chart_type } = result;
  const primaryMetric = metrics[0] ?? "spend";
  const primaryDim    = dimensions[0] ?? "platform";
  const hasData       = data.length > 0;
  const cols          = [...dimensions, ...metrics];

  return (
    <div className="space-y-5">
      {!hasData && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          No data for the selected filters
        </div>
      )}

      {hasData && chart_type === "line" && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey={primaryDim} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtNum} width={44} />
              <Tooltip formatter={(v: unknown) => fmtNum(v)} contentStyle={{ fontSize: 12 }} />
              {metrics.map((m, i) => (
                <Line key={m} type="monotone" dataKey={m} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasData && chart_type === "bar" && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
              <YAxis type="category" dataKey={primaryDim} width={100} tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v: string) => v?.length > 14 ? v.slice(0, 14) + "…" : v} />
              <Tooltip formatter={(v: unknown) => fmtNum(v)} contentStyle={{ fontSize: 12 }} />
              {metrics.map((m, i) => (
                <Bar key={m} dataKey={m} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasData && chart_type === "donut" && (
        <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-center">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data} dataKey={primaryMetric} nameKey={primaryDim} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {data.map((_: unknown, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: unknown) => fmtNum(v)} contentStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {hasData && (
        <div className="overflow-x-auto rounded-xl border shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {cols.map((k) => (
                  <th key={k} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  {cols.map((k) => (
                    <td key={k} className="px-4 py-2.5 text-foreground/80">
                      {fmtNum(row[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 50 && (
            <p className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/20">
              {data.length} total rows
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SavedReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const report      = useSavedReport(id);
  const runReport   = useCustomReport();
  const deleteReport = useDeleteSavedReport();

  const [result, setResult] = useState<CustomReportData | null>(null);

  // Auto-run the report once the config is loaded
  useEffect(() => {
    if (!report.data) return;
    const r = report.data;
    runReport.mutate(
      {
        metrics:    r.metrics,
        dimensions: r.dimensions,
        filters:    r.filters,
        chart_type: r.chart_type,
      },
      { onSuccess: (data) => setResult(data) }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.data?._id]);

  function handleDelete() {
    if (!report.data) return;
    deleteReport.mutate(report.data._id, {
      onSuccess: () => router.push("/reports"),
    });
  }

  const r = report.data;
  const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
  const ChartIcon = r ? (CHART_ICON[r.chart_type] ?? BarChart2) : BarChart2;

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to Reports
      </Link>

      {/* Loading state */}
      {report.isLoading && (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          Loading report…
        </div>
      )}

      {/* Not found */}
      {!report.isLoading && !r && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-sm text-muted-foreground">Report not found.</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/reports")}>
            Go back
          </Button>
        </div>
      )}

      {r && (
        <AnimatePresence>
          <motion.div
            key="content"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            className="space-y-5"
          >
            {/* Header */}
            <PageHeader
              title={r.name}
              action={
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteReport.isPending}
                >
                  {deleteReport.isPending
                    ? <RefreshCw className="mr-1.5 size-3 animate-spin" />
                    : <Trash2 className="mr-1.5 size-3" />}
                  Delete
                </Button>
              }
            />

            {/* Config summary */}
            <div className="flex flex-wrap gap-2">
              {/* Chart type */}
              <span className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <ChartIcon className="size-3.5" />
                <span className="capitalize">{r.chart_type} chart</span>
              </span>
              {/* Metrics */}
              {r.metrics.map((m) => (
                <span
                  key={m}
                  className="flex items-center gap-1 rounded-lg border bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                >
                  <Tag className="size-3" />
                  {m}
                </span>
              ))}
              {/* Dimensions */}
              {r.dimensions.map((d) => (
                <span
                  key={d}
                  className="flex items-center gap-1 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  {d}
                </span>
              ))}
              {/* Date range */}
              {(r.filters.date_from || r.filters.date_to) && (
                <span className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="size-3.5" />
                  {r.filters.date_from} – {r.filters.date_to}
                </span>
              )}
              {/* Created at */}
              <span className="ml-auto text-xs text-muted-foreground self-center">
                Saved {fmt.format(new Date(r.created_at))}
              </span>
            </div>

            {/* Re-run button */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  runReport.mutate(
                    { metrics: r.metrics, dimensions: r.dimensions, filters: r.filters, chart_type: r.chart_type },
                    { onSuccess: (data) => setResult(data) }
                  )
                }
                disabled={runReport.isPending}
              >
                {runReport.isPending
                  ? <RefreshCw className="mr-1.5 size-3 animate-spin" />
                  : <RefreshCw className="mr-1.5 size-3" />}
                Re-run
              </Button>
              {result && (
                <span className="text-xs text-muted-foreground">
                  {result.data.length} row{result.data.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Results */}
            <AnimatePresence mode="wait">
              {runReport.isPending && (
                <motion.div
                  key="loading"
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex h-40 items-center justify-center rounded-xl border bg-card gap-2 text-sm text-muted-foreground"
                >
                  <RefreshCw className="size-4 animate-spin" />
                  Running report…
                </motion.div>
              )}

              {result && !runReport.isPending && (
                <motion.div
                  key="results"
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <ResultView result={result} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
