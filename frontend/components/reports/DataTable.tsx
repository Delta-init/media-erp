"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { listItemVariants } from "@/lib/animations";
import type { CampaignRow } from "@/types/report";

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt(key: string, val: number): string {
  if (key === "spend" || key === "revenue") {
    return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (key === "ctr") return `${val.toFixed(2)}%`;
  if (key === "cpc") return `$${val.toFixed(2)}`;
  if (key === "roas") return `${val.toFixed(2)}×`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

// ── Column definitions ────────────────────────────────────────────────────────
const COLUMNS: { key: keyof CampaignRow; label: string; align?: "right" }[] = [
  { key: "campaign_name", label: "Campaign" },
  { key: "platform",      label: "Platform" },
  { key: "spend",         label: "Spend",       align: "right" },
  { key: "impressions",   label: "Impr.",        align: "right" },
  { key: "clicks",        label: "Clicks",       align: "right" },
  { key: "ctr",           label: "CTR",          align: "right" },
  { key: "cpc",           label: "CPC",          align: "right" },
  { key: "conversions",   label: "Conv.",        align: "right" },
  { key: "revenue",       label: "Revenue",      align: "right" },
  { key: "roas",          label: "ROAS",         align: "right" },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface DataTableProps {
  rows: CampaignRow[];
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  loading?: boolean;
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {COLUMNS.map((c) => (
        <td key={c.key} className="px-4 py-3">
          <div className="h-3.5 animate-pulse rounded-md bg-muted" style={{ width: c.key === "campaign_name" ? "75%" : "60%" }} />
        </td>
      ))}
    </tr>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DataTable({ rows, sortBy, sortDir, onSort, loading }: DataTableProps) {
  function SortIcon({ col }: { col: string }) {
    if (col !== sortBy) return <ArrowUpDown className="ml-1 inline size-3 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp   className="ml-1 inline size-3 text-primary" />
      : <ArrowDown className="ml-1 inline size-3 text-primary" />;
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        {/* Head */}
        <thead>
          <tr className="border-b bg-muted/30">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => col.key !== "campaign_name" && col.key !== "platform" ? onSort(col.key) : onSort(col.key)}
                className={cn(
                  "cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                {col.label}
                <SortIcon col={col.key} />
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="py-14 text-center text-sm text-muted-foreground">
                No campaigns found
              </td>
            </tr>
          ) : (
            <AnimatePresence mode="wait">
              {rows.map((row, i) => (
                <motion.tr
                  key={`${row.campaign_id}-${i}`}
                  variants={listItemVariants}
                  initial="initial"
                  animate="animate"
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="max-w-[200px] truncate px-4 py-3 font-medium" title={row.campaign_name}>
                    {row.campaign_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                      {row.platform.replace(/_/g, " ")}
                    </span>
                  </td>
                  {(["spend","impressions","clicks","ctr","cpc","conversions","revenue","roas"] as const).map((k) => (
                    <td key={k} className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {fmt(k, row[k])}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          )}
        </tbody>
      </table>
    </div>
  );
}
