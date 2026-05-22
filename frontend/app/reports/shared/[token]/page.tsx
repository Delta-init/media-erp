"use client";

import { use } from "react";
import { motion } from "framer-motion";
import {
  BarChart2,
  Calendar,
  Globe,
  Loader2,
  Lock,
  TrendingUp,
} from "lucide-react";
import { useSharedReport } from "@/hooks/useReports";
import { DataTable } from "@/components/reports/DataTable";
import { kpiContainerVariants, kpiCardVariants } from "@/lib/animations";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") {
    return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return String(val);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data, isLoading, error } = useSharedReport(token);

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="size-5 text-primary" />
            <span className="font-semibold tracking-tight">mediaERP</span>
            <span className="hidden text-muted-foreground sm:inline">/ Shared Report</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <Globe className="size-3" />
            Public · Read-only
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {isLoading && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Loading report…</p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex h-64 flex-col items-center justify-center gap-3"
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
              <Lock className="size-6 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold">Report not available</h1>
            <p className="text-sm text-muted-foreground">
              This link may have expired or sharing may have been disabled.
            </p>
          </motion.div>
        )}

        {data && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* Report header */}
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {data.report.name ?? "Shared Report"}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {data.report.filters?.date_from && (
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {data.report.filters.date_from}
                    {data.report.filters.date_to && ` → ${data.report.filters.date_to}`}
                  </span>
                )}
                {data.report.filters?.platform && (
                  <span className="capitalize rounded-full bg-muted px-2 py-0.5">
                    {data.report.filters.platform}
                  </span>
                )}
                {data.report.metrics?.map((m: string) => (
                  <span key={m} className="rounded-full bg-primary/10 px-2 py-0.5 text-primary capitalize">
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary KPIs */}
            {data.data.data.length > 0 && data.data.metrics.length > 0 && (
              <motion.div
                variants={kpiContainerVariants}
                initial="initial"
                animate="animate"
                className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
              >
                {data.data.metrics.slice(0, 4).map((metric) => {
                  // Sum numeric values across rows
                  const total = (data.data.data as Record<string, unknown>[]).reduce(
                    (acc, row) => acc + (typeof row[metric] === "number" ? (row[metric] as number) : 0),
                    0
                  );
                  return (
                    <motion.div
                      key={metric}
                      variants={kpiCardVariants}
                      className="rounded-2xl border bg-card p-5"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        <TrendingUp className="size-3.5" />
                        {metric}
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums">
                        {formatValue(total)}
                      </p>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Data table */}
            <div className="rounded-2xl border bg-card">
              <div className="border-b px-6 py-4">
                <h2 className="font-semibold">Report Data</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {data.data.data.length} row{data.data.data.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="overflow-x-auto">
                {data.data.data.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                    No data available for this report
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {[...data.data.dimensions, ...data.data.metrics].map((col) => (
                          <th
                            key={col}
                            className="px-4 py-3 text-left font-medium text-muted-foreground capitalize"
                          >
                            {col.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(data.data.data as Record<string, unknown>[]).map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          {[...data.data.dimensions, ...data.data.metrics].map((col) => (
                            <td key={col} className="px-4 py-3 tabular-nums">
                              {formatValue(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground">
              This report was shared via{" "}
              <span className="font-medium text-foreground">mediaERP</span> and is read-only.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
