"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  User,
  Users,
  Flag,
  CheckCircle2,
} from "lucide-react";
import {
  useMediaTasks,
  useCreateMediaTask,
  useUpdateMediaTask,
  useCancelMediaTask,
  type MediaTask,
} from "@/hooks/useMediaSchedule";
import { useTeams } from "@/hooks/useTeams";
import { useUsersList } from "@/hooks/useUsers";
import { useTasks } from "@/hooks/useProjects";
import { useAuthStore } from "@/stores/authStore";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_HEADERS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const PRIORITY_DOT: Record<string, string> = {
  low:    "bg-blue-400",
  medium: "bg-amber-400",
  high:   "bg-red-500",
};

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-blue-500/10    text-blue-600  dark:text-blue-400  border-blue-500/30",
  active:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  completed: "bg-muted          text-muted-foreground border-border",
  cancelled: "bg-red-500/10    text-red-600   dark:text-red-400   border-red-500/30",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, "0"); }

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseDate(iso: string) {
  return iso.slice(0, 10); // "2026-06-15T00:00:00+00:00" → "2026-06-15"
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL_CLS = "block text-xs font-medium text-muted-foreground mb-1";

// ─── TaskModal ─────────────────────────────────────────────────────────────────

interface TaskModalProps {
  onClose: () => void;
  teams: ReturnType<typeof useTeams>["data"];
  initial?: MediaTask | null;
}

function TaskModal({ onClose, teams = [], initial }: TaskModalProps) {
  const create  = useCreateMediaTask();
  const update  = useUpdateMediaTask();
  const loading = create.isPending || update.isPending;

  const [form, setForm] = useState({
    title:       initial?.title       ?? "",
    description: initial?.description ?? "",
    team_id:     initial?.team_id     ?? "",
    assigned_to: initial?.assigned_to ?? "",
    start_date:  initial ? parseDate(initial.start_date) : "",
    due_date:    initial ? parseDate(initial.due_date)   : "",
    priority:    initial?.priority    ?? "medium",
  });

  const teamObj  = teams.find((t) => t.id === form.team_id);
  const members  = (teamObj as any)?.members ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.team_id || !form.assigned_to ||
        !form.start_date    || !form.due_date) return;
    if (initial) {
      await update.mutateAsync({ id: initial.id, ...form });
    } else {
      await create.mutateAsync(form);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg rounded-xl border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-sm">
            {initial ? "Edit Task" : "Schedule New Task"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className={LABEL_CLS}>Task Title *</label>
            <input
              className={INPUT_CLS}
              placeholder="e.g. Design social media banner"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className={LABEL_CLS}>Description</label>
            <textarea
              className={cn(INPUT_CLS, "resize-none h-20")}
              placeholder="Optional notes…"
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Team + Assigned To */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Team *</label>
              <select
                className={INPUT_CLS}
                value={form.team_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, team_id: e.target.value, assigned_to: "" }))
                }
                required
              >
                <option value="">Select team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLS}>Assign To *</label>
              <select
                className={INPUT_CLS}
                value={form.assigned_to}
                onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                required
                disabled={!form.team_id}
              >
                <option value="">Select member</option>
                {members.map((m: any) => (
                  <option key={m.user_id} value={m.user_id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Start Date *</label>
              <input
                type="date"
                className={INPUT_CLS}
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Due Date *</label>
              <input
                type="date"
                className={INPUT_CLS}
                value={form.due_date}
                min={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className={LABEL_CLS}>Priority</label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-xs font-medium capitalize transition-colors",
                    form.priority === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <Loader2 className="size-3 mr-1.5 animate-spin" />}
              {initial ? "Save Changes" : "Schedule Task"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── TaskDetailPanel ───────────────────────────────────────────────────────────

interface DetailPanelProps {
  task: MediaTask;
  teams: ReturnType<typeof useTeams>["data"];
  onClose: () => void;
  onEdit: () => void;
}

function TaskDetailPanel({ task, teams = [], onClose, onEdit }: DetailPanelProps) {
  const cancel = useCancelMediaTask();
  const update = useUpdateMediaTask();

  const teamObj  = teams.find((t) => t.id === task.team_id);
  const member   = (teamObj as any)?.members?.find((m: any) => m.user_id === task.assigned_to);
  const canAct   = task.status !== "cancelled" && task.status !== "completed";

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed right-0 top-0 h-full w-80 bg-card border-l shadow-2xl z-40 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-semibold">Task Details</span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {/* Status */}
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border capitalize",
            STATUS_BADGE[task.status] ?? STATUS_BADGE.scheduled
          )}
        >
          {task.status}
        </span>

        {/* Title */}
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Task</p>
          <p className="font-medium">{task.title}</p>
        </div>

        {task.description && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Description</p>
            <p className="text-muted-foreground leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Team */}
        <div className="flex items-start gap-2">
          <Users className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Team</p>
            <p>{(teamObj as any)?.name ?? task.team_id}</p>
          </div>
        </div>

        {/* Assigned to */}
        <div className="flex items-start gap-2">
          <User className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Assigned to</p>
            <p>{member?.name ?? task.assigned_to}</p>
            {member?.designation && (
              <p className="text-xs text-muted-foreground">{member.designation}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-medium">{fmtDate(task.start_date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Due Date</p>
              <p className="font-medium">{fmtDate(task.due_date)}</p>
            </div>
          </div>
        </div>

        {/* Priority */}
        <div className="flex items-start gap-2">
          <Flag
            className={cn(
              "size-3.5 mt-0.5 shrink-0",
              task.priority === "high"
                ? "text-red-500"
                : task.priority === "medium"
                ? "text-amber-500"
                : "text-blue-400"
            )}
          />
          <div>
            <p className="text-xs text-muted-foreground">Priority</p>
            <p className="capitalize">{task.priority}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {canAct && (
        <div className="p-4 border-t flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onEdit}
            >
              Edit
            </Button>
            {task.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={async () => {
                  await update.mutateAsync({ id: task.id, status: "completed" });
                  onClose();
                }}
                disabled={update.isPending}
              >
                <CheckCircle2 className="size-3.5 mr-1" />
                Complete
              </Button>
            )}
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              await cancel.mutateAsync(task.id);
              onClose();
            }}
            disabled={cancel.isPending}
          >
            {cancel.isPending
              ? <Loader2 className="size-3.5 mr-1 animate-spin" />
              : null}
            Cancel Task
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// ─── DayCell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
  day: number | null;
  isToday: boolean;
  startTasks: MediaTask[];
  dueTasks: MediaTask[];
  projectDueTasks: Array<{ id: string; title: string }>;
  onTaskClick: (t: MediaTask) => void;
}

function DayCell({ day, isToday, startTasks, dueTasks, projectDueTasks, onTaskClick }: DayCellProps) {
  type EventItem =
    | { kind: "media"; task: MediaTask; type: "start" | "due" }
    | { kind: "project"; id: string; title: string };

  const allEvents: EventItem[] = [
    ...startTasks.map((t): EventItem    => ({ kind: "media",   task: t, type: "start" })),
    ...dueTasks.map((t): EventItem      => ({ kind: "media",   task: t, type: "due"   })),
    ...projectDueTasks.map((t): EventItem => ({ kind: "project", id: t.id, title: t.title })),
  ];
  const shown = allEvents.slice(0, 3);
  const more  = allEvents.length - shown.length;

  if (day === null) {
    return (
      <div className="min-h-[7rem] border-b border-r border-border/30 bg-muted/5" />
    );
  }

  return (
    <div className="min-h-[7rem] border-b border-r border-border/30 p-1.5 flex flex-col gap-0.5">
      {/* Day number */}
      <div className="mb-0.5">
        <span
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
            isToday
              ? "bg-primary text-primary-foreground font-bold"
              : "text-muted-foreground"
          )}
        >
          {day}
        </span>
      </div>

      {/* Events */}
      {shown.map((ev, i) => {
        if (ev.kind === "media") {
          return (
            <button
              key={`${ev.task.id}-${ev.type}-${i}`}
              onClick={() => onTaskClick(ev.task)}
              title={`${ev.type === "start" ? "▶ Start" : "⏰ Due"}: ${ev.task.title}`}
              className={cn(
                "w-full text-left rounded px-1.5 py-0.5 text-[10px] leading-tight",
                "truncate font-medium border transition-opacity hover:opacity-75",
                ev.type === "start"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
              )}
            >
              {ev.type === "start" ? "▶ " : "⏰ "}
              {ev.task.title}
            </button>
          );
        }
        // Project task due date — amber
        return (
          <span
            key={`proj-${ev.id}-${i}`}
            title={`📋 Project due: ${ev.title}`}
            className="w-full text-left rounded px-1.5 py-0.5 text-[10px] leading-tight truncate font-medium border bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
          >
            📋 {ev.title}
          </span>
        );
      })}

      {more > 0 && (
        <span className="text-[10px] text-muted-foreground pl-1 leading-tight">
          +{more} more
        </span>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MediaSchedulePage() {
  const todayObj = new Date();

  // ── Month navigation
  const [year,  setYear]  = useState(todayObj.getFullYear());
  const [month, setMonth] = useState(todayObj.getMonth()); // 0-indexed

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }
  function goToday() {
    setYear(todayObj.getFullYear());
    setMonth(todayObj.getMonth());
  }

  // ── Role-based access
  const { user } = useAuthStore();
  const roleName  = user?.role?.role_name?.toLowerCase() ?? "";
  const canViewAll = ["super admin", "admin", "coordinator"].some((r) =>
    roleName.includes(r)
  );

  // ── Filters
  const [filterTeam,     setFilterTeam]     = useState("");
  const [filterMember,   setFilterMember]   = useState("");
  const [filterDateType, setFilterDateType] = useState<"both" | "start" | "due">("both");
  const { data: teams = [] } = useTeams();
  // Load ALL users — backend max is 500 (raised from 100); no status filter
  const { data: usersData } = useUsersList({ limit: 500, page: 1 });
  const allUsersFromDb = usersData?.users ?? [];

  // When a team is selected, restrict to that team's member IDs only
  const selectedTeamObj  = teams.find((t) => t.id === filterTeam);
  const teamMemberIds    = useMemo(
    () => new Set((selectedTeamObj as any)?.members?.map((m: any) => m.user_id) ?? []),
    [selectedTeamObj]
  );

  // Users shown in the dropdown: all DB users (sorted), filtered to team members when a team is active
  const visibleUsers = useMemo(() => {
    const base = allUsersFromDb
      .filter((u) => !filterTeam || teamMemberIds.has(u.id))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return base;
  }, [allUsersFromDb, filterTeam, teamMemberIds]);

  // ── Data
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const from_date   = `${year}-${pad2(month + 1)}-01`;
  const to_date     = `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`;

  // Non-admins can only see their own tasks
  const effectiveAssignedTo = canViewAll
    ? (filterMember || undefined)
    : (user?.id || undefined);

  const { data: tasks = [], isLoading } = useMediaTasks({
    team_id:     canViewAll ? (filterTeam || undefined) : undefined,
    assigned_to: effectiveAssignedTo,
    from_date,
    to_date,
  });

  // Project tasks for the same month — shows their due dates on the calendar
  const { data: projectTasks = [] } = useTasks({
    date_filter: "custom",
    date_from:   from_date,
    date_to:     to_date,
    ...(filterTeam   && canViewAll ? { team_id:   filterTeam }   : {}),
    ...(effectiveAssignedTo        ? { member_id: effectiveAssignedTo } : {}),
  });

  // ── Calendar cells
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const totalCells     = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  const cells = useMemo(
    () =>
      Array.from({ length: totalCells }, (_, i) => {
        const d = i - firstDayOfWeek + 1;
        return d >= 1 && d <= daysInMonth ? d : null;
      }),
    [totalCells, firstDayOfWeek, daysInMonth]
  );

  const startMap = useMemo(() => {
    const m: Record<string, MediaTask[]> = {};
    for (const t of tasks) {
      const d = parseDate(t.start_date);
      (m[d] ??= []).push(t);
    }
    return m;
  }, [tasks]);

  const dueMap = useMemo(() => {
    const m: Record<string, MediaTask[]> = {};
    for (const t of tasks) {
      const d = parseDate(t.due_date);
      (m[d] ??= []).push(t);
    }
    return m;
  }, [tasks]);

  // Project tasks keyed by due_date — shown as amber badges
  const projectDueMap = useMemo(() => {
    const m: Record<string, Array<{ id: string; title: string }>> = {};
    for (const t of projectTasks) {
      if (!t.due_date) continue;
      const d = parseDate(t.due_date);
      (m[d] ??= []).push({ id: String((t as any).id ?? (t as any)._id ?? ""), title: t.title });
    }
    return m;
  }, [projectTasks]);

  const todayStr = toDateStr(
    todayObj.getFullYear(),
    todayObj.getMonth(),
    todayObj.getDate()
  );

  // ── Modals
  const [showCreate,  setShowCreate]  = useState(false);
  const [editTask,    setEditTask]    = useState<MediaTask | null>(null);
  const [detailTask,  setDetailTask]  = useState<MediaTask | null>(null);

  function openDetail(task: MediaTask) {
    setDetailTask(task);
  }
  function openEditFromDetail() {
    setEditTask(detailTask);
    setDetailTask(null);
  }

  const selectCls =
    "rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Media Schedule"
        subtitle="Plan and assign media tasks on a timeline"
        action={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="size-3.5 mr-1" />
            New Task
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month nav */}
        <div className="flex items-center gap-0.5 rounded-lg border bg-card px-1 py-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded hover:bg-muted transition-colors"
          >
            <ChevronLeft className="size-4 text-muted-foreground" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold px-2">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded hover:bg-muted transition-colors"
          >
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={goToday}>
          Today
        </Button>

        <div className="flex-1" />

        {/* Date-type filter */}
        <div className="flex rounded-lg border bg-card overflow-hidden text-xs font-medium">
          {(["both", "start", "due"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterDateType(v)}
              className={cn(
                "px-3 py-1.5 transition-colors capitalize",
                filterDateType === v
                  ? v === "start"
                    ? "bg-emerald-500 text-white"
                    : v === "due"
                    ? "bg-red-500 text-white"
                    : "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {v === "both" ? "All Events" : v === "start" ? "Start Dates" : "Due Dates"}
            </button>
          ))}
        </div>

        {/* Team + User filters — admins/coordinators only */}
        {canViewAll && (
          <>
            <select
              className={selectCls}
              value={filterTeam}
              onChange={(e) => {
                setFilterTeam(e.target.value);
                setFilterMember("");
              }}
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <select
              className={selectCls}
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
            >
              <option value="">All Users</option>
              {visibleUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}{u.designation ? ` — ${u.designation}` : ""}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        {filterDateType !== "due" && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            Start Date
          </span>
        )}
        {filterDateType !== "start" && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-red-500" />
              Media Due Date
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" />
              Project Due Date
            </span>
          </>
        )}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" />
          Today
        </span>
        {isLoading && (
          <span className="flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" />
            Loading…
          </span>
        )}
      </div>

      {/* Calendar */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const dayStr = day ? toDateStr(year, month, day) : "";
            return (
              <DayCell
                key={idx}
                day={day}
                isToday={dayStr === todayStr}
                startTasks={dayStr && filterDateType !== "due"   ? (startMap[dayStr]      ?? []) : []}
                dueTasks={dayStr   && filterDateType !== "start" ? (dueMap[dayStr]        ?? []) : []}
                projectDueTasks={dayStr && filterDateType !== "start" ? (projectDueMap[dayStr] ?? []) : []}
                onTaskClick={openDetail}
              />
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(showCreate || editTask) && (
          <TaskModal
            key={editTask?.id ?? "new"}
            onClose={() => { setShowCreate(false); setEditTask(null); }}
            teams={teams}
            initial={editTask}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailTask && (
          <TaskDetailPanel
            key={detailTask.id}
            task={detailTask}
            teams={teams}
            onClose={() => setDetailTask(null)}
            onEdit={openEditFromDetail}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
