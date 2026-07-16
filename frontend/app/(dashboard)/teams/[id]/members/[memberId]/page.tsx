"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, AlertCircle, Crown, User,
  CheckCircle2, Clock, AlertTriangle, BarChart3,
  Calendar, Mail, Briefcase, TrendingUp, PlayCircle,
  PauseCircle, RefreshCw, Send, CheckCheck,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemberReport, useMemberActivity, type ReportPeriod } from "@/hooks/useTeams";
import { fmtDate, fmtDateOnly } from "@/lib/datetime";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = "lg" }: { name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const s = { sm: "size-8", md: "size-10", lg: "size-14", xl: "size-20" }[size];
  const colors = ["#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316","#22c55e","#14b8a6","#3b82f6"];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`${s} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: color, fontSize: size === "xl" ? 28 : undefined }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:        { label: "Pending",        color: "#6366f1", icon: <Clock className="size-3.5" /> },
  started:        { label: "Started",        color: "#3b82f6", icon: <PlayCircle className="size-3.5" /> },
  break:          { label: "Break",          color: "#f97316", icon: <PauseCircle className="size-3.5" /> },
  reedit:         { label: "Reedit",         color: "#ef4444", icon: <RefreshCw className="size-3.5" /> },
  pending_review: { label: "Pending Review", color: "#8b5cf6", icon: <Send className="size-3.5" /> },
  approved:       { label: "Approved",       color: "#22c55e", icon: <CheckCheck className="size-3.5" /> },
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "#22c55e", medium: "#f97316", high: "#ef4444",
};

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, icon, color }: {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className="flex justify-center mb-2" style={{ color: color || "inherit" }}>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MemberReportPage() {
  const params   = useParams<{ id: string; memberId: string }>();
  const router   = useRouter();
  const teamId   = params.id;
  const memberId = params.memberId;

  const { data: report, isLoading, isError } = useMemberReport(teamId, memberId);

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (isError || !report) return (
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <AlertCircle className="size-8 text-destructive/60" />
      <p className="text-sm text-muted-foreground">Report not found or access denied.</p>
      <Button variant="outline" size="sm" onClick={() => router.push(`/teams/${teamId}`)}>
        <ArrowLeft className="size-4 mr-1.5" /> Back to Team
      </Button>
    </div>
  );

  const { user, tasks, member_since, team_name } = report;
  const { total, completed, completion_pct, by_status, by_priority, recent } = tasks;

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Back nav */}
      <button
        onClick={() => router.push(`/teams/${teamId}`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="size-4" /> {team_name}
      </button>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border bg-card shadow-sm overflow-hidden"
      >
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-8 mb-4">
            <Avatar name={user.name || "?"} size="xl" />
            <div className="pb-1">
              <h1 className="text-xl font-bold">{user.name}</h1>
              <p className="text-sm text-muted-foreground">{user.designation || "Team Member"}</p>
            </div>
            <div className="ml-auto pb-1">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                user.status === "active"
                  ? "bg-green-500/15 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {user.status === "active" ? "● Active" : "○ Inactive"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="size-3.5 shrink-0" />
              <span>{user.designation || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="size-3.5 shrink-0" />
              <span>Joined team: {fmtDate(member_since)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Daily report (period-scoped activity) */}
      <DailyReportPanel teamId={teamId} userId={memberId} />

      {/* Overview stats */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Task Overview (all time)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={total}        label="Total Tasks"  icon={<BarChart3 className="size-5" />} />
          <StatCard value={completed}    label="Completed"    icon={<CheckCircle2 className="size-5" />} color="#22c55e" />
          <StatCard value={total - completed} label="Remaining" icon={<Clock className="size-5" />} color="#f97316" />
          <StatCard value={`${completion_pct}%`} label="Completion" icon={<TrendingUp className="size-5" />} color="#6366f1" />
        </div>
      </div>

      {/* Completion bar */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex justify-between text-sm mb-3">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">{completion_pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${completion_pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{completed} done</span>
          <span>{total - completed} remaining</span>
        </div>
      </div>

      {/* By status + by priority */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* By status */}
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Tasks by Status</h3>
          {Object.keys(by_status).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks assigned.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(by_status).map(([status, count]) => {
                const meta = STATUS_META[status] || { label: status, color: "#6366f1", icon: null };
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5">
                        <span style={{ color: meta.color }}>{meta.icon}</span>
                        {meta.label}
                      </span>
                      <span className="font-medium">{count} <span className="text-muted-foreground">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* By priority */}
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Tasks by Priority</h3>
          {Object.keys(by_priority).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks assigned.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(by_priority).map(([priority, count]) => {
                const color = PRIORITY_COLOR[priority] || "#6366f1";
                const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={priority}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium capitalize">{priority}</span>
                      <span>{count} <span className="text-muted-foreground">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent tasks */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold">Recent Tasks</h3>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <CheckCircle2 className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No tasks yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {recent.map((task) => {
              const meta  = STATUS_META[task.status] || { label: task.status, color: "#6366f1", icon: null };
              const pColor = PRIORITY_COLOR[task.priority] || "#6366f1";
              return (
                <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: meta.color }}>{meta.label}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-xs font-medium capitalize" style={{ color: pColor }}>{task.priority}</span>
                      {task.due_date && (
                        <>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Calendar className="size-3" /> {task.due_date}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {timeAgo(task.updated_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Daily report panel (period-scoped activity) ───────────────────────────────

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "daily",   label: "Daily" },
  { id: "weekly",  label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "custom",  label: "Custom" },
];

function shortDate(iso: string) {
  return iso.length === 10
    ? fmtDateOnly(iso, { month: "short", day: "numeric" })
    : iso;
}

function DailyReportPanel({ teamId, userId }: { teamId: string; userId: string }) {
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [from, setFrom] = useState("");
  const [to, setTo]     = useState("");

  const { data, isLoading, isError } = useMemberActivity(teamId, userId, period, from, to);

  const chartData = (data?.timeseries ?? []).map((d) => ({ ...d, label: shortDate(d.date) }));
  const hasChartData = chartData.some((d) => d.created > 0 || d.completed > 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold">Daily Report</h2>
        <div className="flex gap-1 rounded-xl bg-muted/50 p-1 border w-fit">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                period === p.id ? "bg-card text-foreground shadow-sm border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-auto text-xs" />
            <span className="text-muted-foreground text-xs">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-auto text-xs" />
          </div>
        )}
        {data && (
          <span className="text-xs text-muted-foreground ml-auto">
            {shortDate(data.date_from)}{data.date_from !== data.date_to ? ` – ${shortDate(data.date_to)}` : ""}
          </span>
        )}
      </div>

      {period === "custom" && !(from && to) ? (
        <div className="rounded-2xl border bg-card py-12 text-center text-sm text-muted-foreground">
          Pick a start and end date to view the report.
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border bg-card py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError || !data ? (
        <div className="rounded-2xl border bg-card py-12 text-center text-sm text-muted-foreground">
          Couldn’t load the daily report.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard value={data.summary.created}   label="Created"     icon={<BarChart3 className="size-5" />} />
            <StatCard value={data.summary.completed} label="Completed"   icon={<CheckCircle2 className="size-5" />} color="#22c55e" />
            <StatCard value={`${data.summary.completion_pct}%`} label="Completion" icon={<TrendingUp className="size-5" />} color="#6366f1" />
            <StatCard value={data.summary.active}    label="Active now"  icon={<PlayCircle className="size-5" />} color="#3b82f6" />
          </div>

          {/* Activity chart */}
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <TrendingUp className="size-4 text-muted-foreground" /> Activity over time
            </p>
            {!hasChartData ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No task activity in this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid var(--border)", background: "var(--card)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="created" name="Created" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tasks worked in period */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="text-sm font-semibold">Tasks in this period</h3>
            </div>
            {data.recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CheckCircle2 className="size-7 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No activity in this period.</p>
              </div>
            ) : (
              <div className="divide-y">
                {data.recent.map((task) => {
                  const meta = STATUS_META[task.status] || { label: task.status, color: "#6366f1", icon: null };
                  const pColor = PRIORITY_COLOR[task.priority] || "#6366f1";
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: meta.color }}>{meta.label}</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-xs font-medium capitalize" style={{ color: pColor }}>{task.priority}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(task.updated_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
