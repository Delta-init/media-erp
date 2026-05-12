"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Download, RefreshCw } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { DataTable } from "@/components/reports/DataTable";
import { Pagination } from "@/components/reports/Pagination";
import { Button } from "@/components/ui/button";
import { useCampaigns, useExportCsv } from "@/hooks/useReports";
import { fadeVariants } from "@/lib/animations";

// ── Platform filter options ───────────────────────────────────────────────────
const PLATFORMS = [
  { value: "",             label: "All platforms"  },
  { value: "google_ads",   label: "Google Ads"     },
  { value: "facebook_ads", label: "Facebook Ads"   },
  { value: "linkedin_ads", label: "LinkedIn Ads"   },
  { value: "ga4",          label: "GA4"            },
  { value: "tiktok_ads",   label: "TikTok Ads"     },
];

function today()      { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
}

export default function CampaignsPage() {
  // Filters
  const [search,   setSearch]   = useState("");
  const [platform, setPlatform] = useState("");
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo,   setDateTo]   = useState(today());

  // Table state
  const [page,    setPage]    = useState(1);
  const [limit,   setLimit]   = useState(20);
  const [sortBy,  setSortBy]  = useState("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const campaigns = useCampaigns({
    page,
    limit,
    search:   search  || undefined,
    platform: platform || undefined,
    sort_by:  sortBy,
    sort_dir: sortDir,
    date_from: dateFrom || undefined,
    date_to:   dateTo   || undefined,
  });

  const exportCsv = useExportCsv();

  const rows   = campaigns.data?.campaigns ?? [];
  const total  = campaigns.data?.total  ?? 0;
  const pages  = campaigns.data?.pages  ?? 0;

  function handleSort(col: string) {
    if (col === sortBy) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
    setPage(1);
  }

  function handleSearch(v: string) { setSearch(v);   setPage(1); }
  function handlePlatform(v: string) { setPlatform(v); setPage(1); }

  return (
    <motion.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      className="space-y-5"
    >
      <PageHeader
        title="Campaigns"
        subtitle={`${total.toLocaleString()} campaigns across all platforms`}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportCsv.mutate({
                metrics: ["spend", "clicks", "impressions", "ctr", "cpc", "conversions", "revenue", "roas"],
                dimensions: ["campaign", "platform"],
                platform: platform || null,
                dateFrom, dateTo,
              })
            }
            disabled={exportCsv.isPending}
          >
            {exportCsv.isPending
              ? <RefreshCw className="mr-1.5 size-3 animate-spin" />
              : <Download   className="mr-1.5 size-3" />}
            Export CSV
          </Button>
        }
      />

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search campaigns…"
          className="w-56"
        />

        {/* Platform filter */}
        <select
          value={platform}
          onChange={(e) => handlePlatform(e.target.value)}
          className="h-8 rounded-lg border bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition text-foreground"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Rows per page */}
        <select
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          className="h-8 rounded-lg border bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition text-foreground"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>

        {/* Refresh spinner */}
        {campaigns.isFetching && (
          <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
        )}

        {/* Date range — pushed right */}
        <div className="ml-auto">
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onFromChange={(v) => { setDateFrom(v); setPage(1); }}
            onToChange={(v)   => { setDateTo(v);   setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        rows={rows}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        loading={campaigns.isLoading}
      />

      {/* Pagination */}
      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={limit}
        onPage={setPage}
      />
    </motion.div>
  );
}
