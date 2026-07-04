"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  X, Printer, UserPlus, CheckCircle2, RotateCcw,
  GitBranch, ArrowRight, Clock, CalendarDays, Hash, Activity,
} from "lucide-react";
import type { Task, TaskHistoryEntry } from "@/types/project";
import { BOARD_COLUMNS, PRIORITY_META, assigneeLabel } from "@/types/project";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  historyEntries: TaskHistoryEntry[];
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function computeStats(entries: TaskHistoryEntry[]) {
  const sorted = [...entries].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  let workMs = 0;
  let breakMs = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = +new Date(sorted[i + 1].timestamp) - +new Date(sorted[i].timestamp);
    if (sorted[i].action === "started") workMs += diff;
    else if (sorted[i].action === "break") breakMs += diff;
  }
  const daysActive =
    sorted.length >= 2
      ? Math.max(1, Math.round((+new Date(sorted[sorted.length - 1].timestamp) - +new Date(sorted[0].timestamp)) / 86400000))
      : 1;
  return { workMs, breakMs, daysActive };
}

/** Return first or last matching history entry for a given action. */
function findActor(entries: TaskHistoryEntry[], action: string, last = false) {
  const matches = [...entries]
    .filter((e) => e.action === action)
    .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  return last ? matches[matches.length - 1] : matches[0];
}

const ACTION_LABELS: Record<string, string> = {
  created:        "Task Created",
  assigned:       "Assigned",
  started:        "Work Started",
  break:          "Paused",
  pending_review: "Submitted for Review",
  approved:       "Approved",
  reedit:         "Sent for Revision",
  routed:         "Routed to Team",
};

const ACTION_COLORS: Record<string, string> = {
  created:        "#3b82f6",
  assigned:       "#6366f1",
  started:        "#10b981",
  break:          "#f59e0b",
  pending_review: "#8b5cf6",
  approved:       "#22c55e",
  reedit:         "#f43f5e",
  routed:         "#f59e0b",
};

function StatusChip({ status }: { status: string }) {
  const col = BOARD_COLUMNS.find((c) => c.key === status);
  const label = col?.label ?? status;
  const color = col?.color ?? "#6366f1";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold border whitespace-nowrap"
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
    >
      {label}
    </span>
  );
}

// ── Key People card config ────────────────────────────────────────────────────

const KEY_PEOPLE = [
  {
    role: "Assigned by",
    action: "assigned",
    last: false,
    emptyMsg: "Not assigned",
    icon: <UserPlus className="size-3.5" />,
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    border: "border-indigo-200 dark:border-indigo-800",
    roleColor: "text-indigo-600 dark:text-indigo-400",
    avatarBg: "bg-indigo-600",
  },
  {
    role: "Approved by",
    action: "approved",
    last: true,
    emptyMsg: "Not yet approved",
    icon: <CheckCircle2 className="size-3.5" />,
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    roleColor: "text-emerald-600 dark:text-emerald-400",
    avatarBg: "bg-emerald-600",
  },
  {
    role: "Sent to Reedit by",
    action: "reedit",
    last: true,
    emptyMsg: "No reedit requested",
    icon: <RotateCcw className="size-3.5" />,
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
    roleColor: "text-rose-600 dark:text-rose-400",
    avatarBg: "bg-rose-600",
  },
  {
    role: "Evaluated by",
    action: "routed",
    last: true,
    emptyMsg: "Not yet evaluated",
    icon: <GitBranch className="size-3.5" />,
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    roleColor: "text-amber-600 dark:text-amber-400",
    avatarBg: "bg-amber-500",
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export function TaskHistoryReport({ task, historyEntries, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  const sorted = [...historyEntries].sort(
    (a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)
  );

  const { workMs, breakMs, daysActive } = computeStats(historyEntries);
  const statusLabel = BOARD_COLUMNS.find((c) => c.key === task.status)?.label ?? task.status;
  const statusColor = BOARD_COLUMNS.find((c) => c.key === task.status)?.color ?? "#6366f1";
  const meta = PRIORITY_META[task.priority];
  const assignee = assigneeLabel(task);

  function handlePrint() {
    // Mark the report root so print CSS can isolate it
    const el = rootRef.current;
    if (!el) { window.print(); return; }
    el.setAttribute("data-report-root", "true");
    document.body.classList.add("printing-report");
    window.print();
    setTimeout(() => {
      el.removeAttribute("data-report-root");
      document.body.classList.remove("printing-report");
    }, 500);
  }

  const STATS = [
    { label: "Work Time",     value: fmtDuration(workMs),          color: "#10b981", icon: <Clock className="size-3.5" /> },
    { label: "Break Time",    value: fmtDuration(breakMs),         color: "#f59e0b", icon: <Activity className="size-3.5" /> },
    { label: "Days Active",   value: `${daysActive}d`,             color: "#6366f1", icon: <CalendarDays className="size-3.5" /> },
    { label: "Total Events",  value: `${historyEntries.length}`,   color: "#f43f5e", icon: <Hash className="size-3.5" /> },
  ];

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      style={{ zIndex: 9999 }}
      data-report-portal=""
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
        className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col bg-white dark:bg-slate-900"
      >
        {/* ── Dark header ── */}
        <div className="bg-slate-900 px-6 py-4 flex items-start justify-between shrink-0 report-print-hide">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Task Report
              </span>
              <span className="text-slate-600">·</span>
              <span
                className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                style={{ color: statusColor, backgroundColor: `${statusColor}25` }}
              >
                {statusLabel}
              </span>
            </div>
            <h2 className="text-white font-bold text-base leading-snug">{task.title}</h2>
            <p className="text-slate-400 text-[11px] mt-1 flex items-center gap-2 flex-wrap">
              {assignee && (
                <>
                  <span>
                    Assigned to{" "}
                    <span className="text-slate-300 font-medium">{assignee}</span>
                  </span>
                  <span className="text-slate-600">·</span>
                </>
              )}
              <span className={cn("font-medium", meta.color.split(" ")[0])}>
                {meta.label} priority
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <Printer className="size-3.5" /> Export PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
            {STATS.map((s) => (
              <div key={s.label} className="p-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {s.label}
                  </span>
                </div>
                <div className="text-2xl font-black tracking-tight" style={{ color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* ── Key People ── */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Key People
              </h3>
              <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                from history
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {KEY_PEOPLE.map(({ role, action, last, emptyMsg, icon, bg, border, roleColor, avatarBg }) => {
                const entry = findActor(historyEntries, action, last);
                return (
                  <div
                    key={role}
                    className={cn("rounded-xl border p-3.5 flex items-center gap-3", bg, border)}
                  >
                    {entry ? (
                      <>
                        <div
                          className={cn(
                            "size-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold",
                            avatarBg
                          )}
                        >
                          {entry.actor_name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider", roleColor)}>
                            {icon} {role}
                          </div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                            {entry.actor_name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {fmtTime(entry.timestamp)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="size-9 shrink-0 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-400 text-base font-bold">
                          —
                        </div>
                        <div>
                          <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider", roleColor)}>
                            {icon} {role}
                          </div>
                          <div className="text-xs text-slate-400 italic mt-0.5">{emptyMsg}</div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Status Journey ── */}
          {sorted.length > 0 && (
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                Status Journey
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-center gap-2 flex-wrap">
                {sorted.map((e, i) => {
                  const color = ACTION_COLORS[e.action] ?? "#6366f1";
                  const label = ACTION_LABELS[e.action] ?? e.action;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-semibold border whitespace-nowrap"
                          style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                        >
                          {label}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(e.timestamp).toLocaleDateString(undefined, {
                            month: "short", day: "numeric",
                          })}
                        </span>
                      </div>
                      {i < sorted.length - 1 && (
                        <ArrowRight className="size-3 text-slate-300 shrink-0 mb-3" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Activity Log Table ── */}
          <div className="p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Activity Log
              <span className="ml-2 font-normal normal-case text-slate-300">
                ({historyEntries.length} events)
              </span>
            </h3>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    {["#", "Action", "By", "Status Change", "Note / Reason", "Date & Time"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left font-bold text-[10px] uppercase tracking-wide text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e, i) => {
                    const color = ACTION_COLORS[e.action] ?? "#6366f1";
                    const label = ACTION_LABELS[e.action] ?? e.action;
                    return (
                      <tr
                        key={i}
                        className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-3 py-2.5 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-block size-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {label}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                          {e.actor_name || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {e.from_status && e.to_status ? (
                            <span className="flex items-center gap-1">
                              <StatusChip status={e.from_status} />
                              <ArrowRight className="size-2.5 text-slate-300 shrink-0" />
                              <StatusChip status={e.to_status} />
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 max-w-[160px]">
                          {e.note ? (
                            <span
                              className={cn(
                                "line-clamp-2",
                                e.action === "reedit" &&
                                  "text-rose-600 dark:text-rose-400 font-medium"
                              )}
                            >
                              {e.note}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                          {fmtTime(e.timestamp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-400 mt-4 text-center">
              Generated · mediaERP Task Management System
            </p>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
