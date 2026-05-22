"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, BarChart2, CheckCircle2, DollarSign, Eye,
  MousePointerClick, RefreshCw, Settings2, TrendingDown,
  TrendingUp, Users, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import Link from "next/link";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { KpiCard } from "@/components/reports/KpiCard";
import { SpendTrendChart } from "@/components/reports/SpendTrendChart";
import { PlatformDonut } from "@/components/reports/PlatformDonut";
import { DataTable } from "@/components/reports/DataTable";
import { Pagination } from "@/components/reports/Pagination";
import { useOverview, useTrend, useCampaigns, useCustomReport } from "@/hooks/useReports";
import { useBudgetAlerts, useBudgetPacing } from "@/hooks/useBudget";
import { useKpiTargets } from "@/hooks/useKpiTargets";
import { useAuthStore } from "@/stores/authStore";
import { kpiContainerVariants } from "@/lib/animations";
import type { OverviewKpis, ReportMetric } from "@/types/report";

// ── Widget config ─────────────────────────────────────────────────────────────
const WIDGET_KEYS = ["kpis","trend","donut","campaigns","budget"] as const;
type WidgetKey = typeof WIDGET_KEYS[number];
const WIDGET_LABELS: Record<WidgetKey, string> = {
  kpis: "KPI Cards", trend: "Performance Trend",
  donut: "Spend by Platform", campaigns: "Top Campaigns", budget: "Budget Pacing",
};

function useWidgetPrefs() {
  const [prefs, setPrefs] = useState<Record<WidgetKey, boolean>>(() => {
    try {
      const raw = localStorage.getItem("dashboard_widgets");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { kpis: true, trend: true, donut: true, campaigns: true, budget: true };
  });
  function toggle(key: WidgetKey) {
    setPrefs(p => {
      const next = { ...p, [key]: !p[key] };
      localStorage.setItem("dashboard_widgets", JSON.stringify(next));
      return next;
    });
  }
  return { prefs, toggle };
}

// ── Pacing status badge ───────────────────────────────────────────────────────
const PACING_BADGE: Record<string, { label: string; className: string }> = {
  on_track:    { label: "On Track",    className: "bg-emerald-500/10 text-emerald-600" },
  overpacing:  { label: "Overpacing",  className: "bg-amber-500/10 text-amber-600" },
  underpacing: { label: "Underpacing", className: "bg-blue-500/10 text-blue-600" },
  exceeded:    { label: "Exceeded",    className: "bg-red-500/10 text-red-600" },
};

// ── Default date range: last 30 days ─────────────────────────────────────────
function today()         { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
}

// ── KPI card config ───────────────────────────────────────────────────────────
interface KpiConf { metric: keyof OverviewKpis; label: string; icon: LucideIcon; color: string; bg: string; }
const KPI_CONF: KpiConf[] = [
  { metric: "spend",       label: "Ad Spend",    icon: DollarSign,        color: "text-amber-500",   bg: "bg-amber-500/10"   },
  { metric: "impressions", label: "Impressions",  icon: Eye,               color: "text-blue-500",    bg: "bg-blue-500/10"    },
  { metric: "clicks",      label: "Clicks",       icon: MousePointerClick, color: "text-sky-500",     bg: "bg-sky-500/10"     },
  { metric: "conversions", label: "Conversions",  icon: Users,             color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { metric: "revenue",     label: "Revenue",      icon: TrendingUp,        color: "text-green-500",   bg: "bg-green-500/10"   },
  { metric: "ctr",         label: "CTR",          icon: BarChart2,         color: "text-violet-500",  bg: "bg-violet-500/10"  },
  { metric: "roas",        label: "ROAS",         icon: TrendingUp,        color: "text-indigo-500",  bg: "bg-indigo-500/10"  },
];

const TREND_METRICS: ReportMetric[] = ["spend", "clicks", "impressions", "conversions", "revenue"];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo,   setDateTo]   = useState(today());
  const [trendMetric, setTrendMetric] = useState<ReportMetric>("spend");
  const [page, setPage] = useState(1);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [showWidgetMenu, setShowWidgetMenu] = useState(false);

  const { prefs, toggle } = useWidgetPrefs();

  // ── Data ──────────────────────────────────────────────────────────────────
  const overview     = useOverview(dateFrom, dateTo);
  const trend        = useTrend(trendMetric, "daily", dateFrom, dateTo);
  const campaigns    = useCampaigns({ page, limit: 5, sort_by: "spend", sort_dir: "desc", date_from: dateFrom, date_to: dateTo });
  const budgetAlerts = useBudgetAlerts();
  const budgetPacing = useBudgetPacing();
  const { data: kpiTargets } = useKpiTargets();

  // Platform breakdown via custom report
  const platformMut = useCustomReport();
  const [platformData, setPlatformData] = useState<{ platform: string; value: number }[]>([]);
  const [platformLoading, setPlatformLoading] = useState(false);

  // Fetch platform data whenever dates change
  useState(() => {
    setPlatformLoading(true);
    platformMut.mutate(
      { metrics: ["spend"], dimensions: ["platform"], filters: { date_from: dateFrom, date_to: dateTo }, chart_type: "donut" },
      {
        onSuccess(data) {
          const rows = data.data as { platform?: string; spend?: number }[];
          setPlatformData(rows.filter((r) => r.platform && r.spend != null).map((r) => ({ platform: r.platform!, value: r.spend! })));
          setPlatformLoading(false);
        },
        onError() { setPlatformLoading(false); },
      }
    );
  });

  const campRows  = campaigns.data?.campaigns ?? [];
  const campTotal = campaigns.data?.total  ?? 0;
  const campPages = campaigns.data?.pages  ?? 0;

  // ── Greeting ──────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const activeAlerts = (budgetAlerts.data ?? []).filter(a => !dismissedAlerts.includes(a.campaign_id));
  const pacingGoals  = budgetPacing.data ?? [];

  // Build metric → target_value lookup from KPI targets (first matching target per metric)
  const kpiTargetMap = (kpiTargets ?? []).reduce<Record<string, number>>((acc, t) => {
    if (!(t.metric in acc)) acc[t.metric] = t.target_value;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Welcome + date range */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening across your marketing channels.
          </p>
        </motion.div>

        <div className="flex items-center gap-2">
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onFromChange={(v) => { setDateFrom(v); setPage(1); }}
            onToChange={(v)   => { setDateTo(v);   setPage(1); }}
          />
          {/* Widget customization */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowWidgetMenu(v => !v)}
              className="flex size-8 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Customize widgets"
            >
              <Settings2 className="size-4" />
            </motion.button>
            <AnimatePresence>
              {showWidgetMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  className="absolute right-0 top-10 z-50 w-52 rounded-xl border bg-card p-3 shadow-xl"
                >
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Show Widgets</p>
                  {WIDGET_KEYS.map(k => (
                    <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
                      <input
                        type="checkbox" checked={prefs[k]}
                        onChange={() => toggle(k)}
                        className="size-3.5 accent-primary rounded"
                      />
                      <span className="text-sm">{WIDGET_LABELS[k]}</span>
                    </label>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Budget Alerts Banner */}
      <AnimatePresence>
        {activeAlerts.slice(0, 3).map(alert => (
          <motion.div
            key={alert.campaign_id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <p className="flex-1 text-sm text-amber-700 dark:text-amber-400">
                <strong>Budget Alert:</strong> &quot;{alert.campaign_name}&quot; has used{" "}
                <strong>{alert.spend_pct.toFixed(0)}%</strong> of its{" "}
                ${alert.total_budget.toLocaleString()} budget (${alert.actual_spend.toFixed(0)} spent)
              </p>
              <button
                onClick={() => setDismissedAlerts(d => [...d, alert.campaign_id])}
                className="shrink-0 rounded-md p-1 text-amber-600 hover:bg-amber-500/20 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* KPI grid */}
      {prefs.kpis && (
        <motion.div
          variants={kpiContainerVariants}
          initial="initial"
          animate="animate"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {KPI_CONF.map((conf) => (
            <KpiCard
              key={conf.metric}
              metric={conf.metric}
              label={conf.label}
              icon={conf.icon}
              color={conf.color}
              bg={conf.bg}
              data={overview.data?.kpis[conf.metric]}
              loading={overview.isLoading}
              target={kpiTargetMap[conf.metric]}
            />
          ))}
        </motion.div>
      )}

      {/* Trend + Donut */}
      {(prefs.trend || prefs.donut) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {prefs.trend && (
            <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Performance Trend</span>
                <div className="ml-auto flex gap-1">
                  {TREND_METRICS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setTrendMetric(m)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                        trendMetric === m
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <SpendTrendChart
                data={trend.data?.data ?? []}
                metric={trendMetric}
                loading={trend.isLoading}
              />
            </div>
          )}
          {prefs.donut && (
            <div className={`rounded-xl border bg-card p-5 shadow-sm ${!prefs.trend ? "lg:col-span-3" : ""}`}>
              <p className="mb-4 text-sm font-medium">Spend by Platform</p>
              <PlatformDonut data={platformData} metric="spend" loading={platformLoading} />
            </div>
          )}
        </div>
      )}

      {/* Budget Pacing */}
      {prefs.budget && pacingGoals.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium">Budget Pacing</p>
            <Link href="/campaigns" className="text-xs text-primary hover:underline">Manage →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {["Campaign","Platform","Budget","Spent","Expected","Pacing","Status"].map(h => (
                    <th key={h} className="pb-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pacingGoals.map(g => {
                  const badge = PACING_BADGE[g.status] ?? PACING_BADGE.on_track;
                  const pct   = g.total_budget > 0 ? (g.actual_spend / g.total_budget) * 100 : 0;
                  return (
                    <tr key={g.campaign_id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 max-w-[160px] truncate font-medium" title={g.campaign_name}>{g.campaign_name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground capitalize">{g.platform.replace(/_/g, " ")}</td>
                      <td className="py-2.5 pr-4 tabular-nums">${g.total_budget.toLocaleString()}</td>
                      <td className="py-2.5 pr-4 tabular-nums">
                        <div className="flex flex-col gap-1">
                          <span>${g.actual_spend.toFixed(0)}</span>
                          <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">${g.expected_spend.toFixed(0)}</td>
                      <td className="py-2.5 pr-4 tabular-nums">
                        <span className={`flex items-center gap-1 text-xs font-medium ${g.pacing_ratio > 1 ? "text-amber-600" : "text-blue-600"}`}>
                          {g.pacing_ratio > 1 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          {(g.pacing_ratio * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                          {g.status === "on_track" && <CheckCircle2 className="size-3" />}
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {prefs.budget && pacingGoals.length === 0 && !budgetPacing.isLoading && (
        <div className="rounded-xl border border-dashed bg-card p-5">
          <p className="text-sm text-muted-foreground text-center">
            No budget goals set.{" "}
            <Link href="/campaigns" className="text-primary hover:underline">
              Set budget goals in Campaigns →
            </Link>
          </p>
        </div>
      )}

      {/* Top campaigns */}
      {prefs.campaigns && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Top Campaigns by Spend</p>
            {campaigns.isFetching && <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <DataTable
            rows={campRows} sortBy="spend" sortDir="desc" onSort={() => {}} loading={campaigns.isLoading}
          />
          <Pagination page={page} pages={campPages} total={campTotal} limit={5} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
