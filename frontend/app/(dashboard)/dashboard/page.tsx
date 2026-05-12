"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  DollarSign, Eye, MousePointerClick, Users,
  TrendingUp, BarChart2, RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { KpiCard } from "@/components/reports/KpiCard";
import { SpendTrendChart } from "@/components/reports/SpendTrendChart";
import { PlatformDonut } from "@/components/reports/PlatformDonut";
import { DataTable } from "@/components/reports/DataTable";
import { Pagination } from "@/components/reports/Pagination";
import { useOverview, useTrend, useCampaigns, useCustomReport } from "@/hooks/useReports";
import { useAuthStore } from "@/stores/authStore";
import { kpiContainerVariants } from "@/lib/animations";
import type { OverviewKpis, ReportMetric } from "@/types/report";

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

  // ── Data ──────────────────────────────────────────────────────────────────
  const overview  = useOverview(dateFrom, dateTo);
  const trend     = useTrend(trendMetric, "daily", dateFrom, dateTo);
  const campaigns = useCampaigns({ page, limit: 5, sort_by: "spend", sort_dir: "desc", date_from: dateFrom, date_to: dateTo });

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

        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFromChange={(v) => { setDateFrom(v); setPage(1); }}
          onToChange={(v)   => { setDateTo(v);   setPage(1); }}
        />
      </div>

      {/* KPI grid */}
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
          />
        ))}
      </motion.div>

      {/* Trend + Donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trend chart */}
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

        {/* Platform donut */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-medium">Spend by Platform</p>
          <PlatformDonut
            data={platformData}
            metric="spend"
            loading={platformLoading}
          />
        </div>
      </div>

      {/* Top campaigns */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Top Campaigns by Spend</p>
          {campaigns.isFetching && (
            <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <DataTable
          rows={campRows}
          sortBy="spend"
          sortDir="desc"
          onSort={() => {}}
          loading={campaigns.isLoading}
        />
        <Pagination
          page={page}
          pages={campPages}
          total={campTotal}
          limit={5}
          onPage={setPage}
        />
      </div>
    </div>
  );
}
