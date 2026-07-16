"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart2,
  PieChart,
  Play,
  RefreshCw,
  Save,
  Table2,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MetricSelector } from "./MetricSelector";
import { FilterPanel } from "./FilterPanel";
import { Button } from "@/components/ui/button";
import { useCustomReport, useSaveReport } from "@/hooks/useReports";
import { fadeVariants } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/datetime";
import type {
  ChartType,
  CustomReportData,
  ReportDimension,
  ReportMetric,
} from "@/types/report";

// ── helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
}

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

// ── Chart types selector ──────────────────────────────────────────────────────

const CHART_TYPES: { value: ChartType; label: string; icon: React.ElementType }[] = [
  { value: "line",  label: "Line",  icon: TrendingUp },
  { value: "bar",   label: "Bar",   icon: BarChart2  },
  { value: "donut", label: "Donut", icon: PieChart   },
  { value: "table", label: "Table", icon: Table2     },
];

// ── Preview ───────────────────────────────────────────────────────────────────

function BuilderPreview({ result }: { result: CustomReportData }) {
  const { data, metrics, dimensions, chart_type } = result;
  const primaryMetric = metrics[0] ?? "spend";
  const primaryDim    = dimensions[0] ?? "platform";
  const hasData       = data.length > 0;
  const cols          = [...dimensions, ...metrics];

  return (
    <div className="space-y-4">
      {!hasData && (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No data for the selected filters
        </div>
      )}

      {/* Line chart */}
      {hasData && chart_type === "line" && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={primaryDim}
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
              formatter={(v: unknown) => fmtNum(v)}
              contentStyle={{ fontSize: 12 }}
            />
            {metrics.map((m, i) => (
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Bar chart */}
      {hasData && chart_type === "bar" && (
        <ResponsiveContainer width="100%" height={220}>
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
              dataKey={primaryDim}
              width={90}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) =>
                v?.length > 12 ? v.slice(0, 12) + "…" : v
              }
            />
            <Tooltip
              formatter={(v: unknown) => fmtNum(v)}
              contentStyle={{ fontSize: 12 }}
            />
            {metrics.map((m, i) => (
              <Bar
                key={m}
                dataKey={m}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Donut / pie */}
      {hasData && chart_type === "donut" && (
        <div className="flex items-center justify-center py-2">
          <ResponsiveContainer width="100%" height={200}>
            <RechartsPieChart>
              <Pie
                data={data}
                dataKey={primaryMetric}
                nameKey={primaryDim}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((_: unknown, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: unknown) => fmtNum(v)}
                contentStyle={{ fontSize: 12 }}
              />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data table (all chart types) */}
      {hasData && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                {cols.map((k) => (
                  <th
                    key={k}
                    className="px-3 py-2 text-left font-semibold capitalize text-muted-foreground"
                  >
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 25).map((row: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                  {cols.map((k) => (
                    <td key={k} className="px-3 py-2 text-foreground/80">
                      {fmtNum(row[k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 25 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Showing 25 of {data.length} rows
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── ReportBuilder ─────────────────────────────────────────────────────────────

interface ReportBuilderProps {
  /** Called after a report is saved (pass the new saved report id) */
  onSaved?: (id: string) => void;
}

export function ReportBuilder({ onSaved }: ReportBuilderProps) {
  // Config state
  const [metrics,    setMetrics]    = useState<ReportMetric[]>(["spend", "clicks"]);
  const [dimensions, setDimensions] = useState<ReportDimension[]>(["platform"]);
  const [chartType,  setChartType]  = useState<ChartType>("bar");
  const [platform,   setPlatform]   = useState("");
  const [dateFrom,   setDateFrom]   = useState(daysAgo(30));
  const [dateTo,     setDateTo]     = useState(today());

  // Save name state
  const [saveName,     setSaveName]     = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Preview state
  const [preview, setPreview] = useState<CustomReportData | null>(null);

  const runReport = useCustomReport();
  const saveReport = useSaveReport();

  function handleRun() {
    setPreview(null);
    runReport.mutate(
      {
        metrics,
        dimensions,
        filters: {
          platform: platform ? [platform] : null,
          date_from: dateFrom,
          date_to: dateTo,
        },
        chart_type: chartType,
      },
      { onSuccess: (data) => setPreview(data) }
    );
  }

  function handleSave() {
    const name = saveName.trim() || `Report ${fmtDate(new Date())}`;
    saveReport.mutate(
      {
        name,
        metrics,
        dimensions,
        filters: {
          platform: platform ? [platform] : null,
          date_from: dateFrom,
          date_to: dateTo,
        },
        chart_type: chartType,
      },
      {
        onSuccess: (saved) => {
          setSaveName("");
          setShowSaveForm(false);
          onSaved?.(saved._id);
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Config card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-5">
        {/* Metrics */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Metrics
          </p>
          <MetricSelector selected={metrics} onChange={setMetrics} />
        </div>

        <div className="border-t" />

        {/* Filters */}
        <FilterPanel
          platform={platform}
          onPlatformChange={setPlatform}
          dimensions={dimensions}
          onDimensionsChange={setDimensions}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />

        <div className="border-t" />

        {/* Chart type */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Visualisation
          </p>
          <div className="flex gap-2">
            {CHART_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setChartType(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                  chartType === value
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            size="sm"
            onClick={handleRun}
            disabled={runReport.isPending}
          >
            {runReport.isPending
              ? <RefreshCw className="mr-1.5 size-3 animate-spin" />
              : <Play className="mr-1.5 size-3" />}
            Run report
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSaveForm((v) => !v)}
            disabled={saveReport.isPending}
          >
            <Save className="mr-1.5 size-3" />
            Save report
          </Button>

          {/* Save name inline form */}
          <AnimatePresence>
            {showSaveForm && (
              <motion.div
                key="save-form"
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Report name…"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                  className="h-8 rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveReport.isPending}
                >
                  {saveReport.isPending
                    ? <RefreshCw className="size-3 animate-spin" />
                    : "Save"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Preview */}
      <AnimatePresence mode="wait">
        {runReport.isPending && (
          <motion.div
            key="loading"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex h-36 items-center justify-center rounded-xl border bg-card"
          >
            <RefreshCw className="size-5 animate-spin text-muted-foreground" />
          </motion.div>
        )}

        {preview && !runReport.isPending && (
          <motion.div
            key="preview"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-xl border bg-card p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Preview</p>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
                {preview.chart_type}
              </span>
            </div>
            <BuilderPreview result={preview} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
