"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail, CheckCircle2, XCircle, Search, Loader2, ShieldAlert,
  RefreshCw, Send,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useEmailLogs, type EmailLog } from "@/hooks/useEmailLogs";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  password_reset: { label: "Password Reset", color: "#6366f1" },
  report:         { label: "Report",         color: "#0ea5e9" },
  rule_alert:     { label: "Rule Alert",      color: "#f97316" },
  client_invite:  { label: "Client Invite",   color: "#8b5cf6" },
  smtp_test:      { label: "SMTP Test",        color: "#14b8a6" },
  general:        { label: "General",          color: "#6b7280" },
};

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "sent";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        ok ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-600 dark:text-red-400"
      )}
    >
      {ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
      {ok ? "Sent" : "Failed"}
    </span>
  );
}

function LogRow({ log }: { log: EmailLog }) {
  const meta = CATEGORY_META[log.category] ?? CATEGORY_META.general;
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: meta.color }}>
          {meta.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium">{log.to}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[280px] truncate">{log.subject}</td>
      <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtTime(log.created_at)}</td>
      <td className="px-4 py-3 text-xs text-red-500/80 max-w-[220px] truncate" title={log.error ?? ""}>{log.error ?? ""}</td>
    </tr>
  );
}

export default function EmailLogsPage() {
  const me = useAuthStore((s) => s.user);
  const isSuperAdmin = !!me?.role?.is_system_role && me?.role?.role_name === "Super Admin";

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useEmailLogs(
    { page, status, search },
    isSuperAdmin
  );

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/10">
          <ShieldAlert className="size-8 text-amber-500" />
        </div>
        <p className="text-sm font-semibold">Super Admin only</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Email logs contain delivery details across all users and are restricted to Super Admins.
        </p>
      </div>
    );
  }

  const stats = data?.stats ?? { sent: 0, failed: 0, total: 0 };

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Mail className="size-6 text-primary" /> Email Logs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every outbound email — password resets, reports, alerts, invites and tests.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={stats.total} icon={<Send className="size-4" />} color="#6366f1" />
        <StatCard label="Sent" value={stats.sent} icon={<CheckCircle2 className="size-4" />} color="#22c55e" />
        <StatCard label="Failed" value={stats.failed} icon={<XCircle className="size-4" />} color="#ef4444" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search recipient or subject…"
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {["", "sent", "failed"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => { setStatus(s); setPage(1); }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                status === s ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sent at</th>
              <th className="px-4 py-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground/50" /></td></tr>
            ) : isError ? (
              <tr><td colSpan={6} className="py-16 text-center text-sm text-red-500/70">Failed to load email logs.</td></tr>
            ) : (data?.logs.length ?? 0) === 0 ? (
              <tr><td colSpan={6} className="py-16 text-center text-sm text-muted-foreground">No emails logged yet.</td></tr>
            ) : (
              data!.logs.map((log) => <LogRow key={log.id} log={log} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {data.page} of {data.pages} · {data.total} total
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
