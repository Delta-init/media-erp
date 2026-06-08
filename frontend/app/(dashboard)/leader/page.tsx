"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, CheckCircle2, RotateCcw, Inbox, UserPlus,
  Loader2, X, AlertCircle, Calendar, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeaderQueue, useUpdateTask, type LeaderTeam } from "@/hooks/useProjects";
import type { Task } from "@/types/project";
import { PRIORITY_META, isTaskOverdue, assigneeLabel } from "@/types/project";
import { cn } from "@/lib/utils";

type Tab = "review" | "assign";

// ── Reedit reason modal ───────────────────────────────────────────────────────

function ReeditModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const update = useUpdateTask();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    await update.mutateAsync({ id: task.id, payload: { status: "reedit", reedit_reason: reason.trim() } });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border bg-card shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="size-4 text-rose-500" />
            <h2 className="text-sm font-semibold">Send to Reedit</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Task: <span className="font-medium text-foreground">{task.title}</span>
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for reedit *</label>
            <textarea
              autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
              placeholder="Explain what needs to change so the assignee knows how to fix it…"
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!reason.trim() || update.isPending}>
              {update.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <RotateCcw className="size-4 mr-1.5" />}
              Send to Reedit
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ task, teamName, onReedit }: { task: Task; teamName: string; onReedit: (t: Task) => void }) {
  const update = useUpdateTask();
  const pri = PRIORITY_META[task.priority];
  const overdue = isTaskOverdue(task);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="text-sm font-semibold leading-snug">{task.title}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", pri.color)}>{pri.label}</span>
      </div>
      {task.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground mb-3">
        {assigneeLabel(task) && (
          <span className="flex items-center gap-1">
            <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[9px]">
              {assigneeLabel(task)[0]?.toUpperCase()}
            </span>
            {assigneeLabel(task)}
          </span>
        )}
        {teamName && <span className="rounded-full bg-muted px-2 py-0.5">{teamName}</span>}
        {task.due_date && (
          <span className={cn("flex items-center gap-0.5", overdue && "text-red-500 font-semibold")}>
            <Calendar className="size-3" />
            {new Date(task.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => update.mutate({ id: task.id, payload: { status: "approved" } })}
          disabled={update.isPending}
        >
          <CheckCircle2 className="size-4 mr-1.5" /> Approve
        </Button>
        <Button size="sm" variant="outline" className="flex-1 border-rose-400/40 text-rose-600 hover:bg-rose-500/10" onClick={() => onReedit(task)}>
          <RotateCcw className="size-4 mr-1.5" /> Reedit
        </Button>
      </div>
    </div>
  );
}

// ── Assign card ───────────────────────────────────────────────────────────────

function AssignCard({ task, team }: { task: Task; team?: LeaderTeam }) {
  const update = useUpdateTask();
  const [memberId, setMemberId] = useState("");
  const pri = PRIORITY_META[task.priority];

  function assign() {
    if (!memberId) return;
    const m = team?.members.find((x) => x.id === memberId);
    update.mutate({ id: task.id, payload: { assigned_to: memberId, assigned_to_name: m?.name ?? "" } });
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="text-sm font-semibold leading-snug">{task.title}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", pri.color)}>{pri.label}</span>
      </div>
      {task.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
        {team?.name && <span className="rounded-full bg-muted px-2 py-0.5">{team.name}</span>}
        {assigneeLabel(task) ? <span>Currently: {assigneeLabel(task)}</span> : <span>Unassigned</span>}
      </div>
      <div className="flex gap-2">
        <select
          value={memberId} onChange={(e) => setMemberId(e.target.value)}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          <option value="">Assign to…</option>
          {team?.members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}{m.role === "leader" ? " (leader)" : ""}</option>
          ))}
        </select>
        <Button size="sm" onClick={assign} disabled={!memberId || update.isPending}>
          {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeaderPage() {
  const { data, isLoading } = useLeaderQueue();
  const [tab, setTab] = useState<Tab>("review");
  const [reeditTask, setReeditTask] = useState<Task | null>(null);

  const teamsById = useMemo(() => {
    const m = new Map<string, LeaderTeam>();
    (data?.teams ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [data]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!data?.is_leader) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
        <Crown className="size-10 text-muted-foreground/30" />
        <p className="font-semibold">Leader Desk</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          This area is for team leaders and admins. You don&apos;t lead any team yet.
        </p>
      </div>
    );
  }

  const review = data.review ?? [];
  const incoming = data.incoming ?? [];

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="size-6 text-primary" /> Leader Desk
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review your team&apos;s submissions and distribute new work.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 border w-fit">
        {([
          { id: "review" as Tab, icon: <ClipboardCheck className="size-4" />, label: "Pending Reviews", count: review.length },
          { id: "assign" as Tab, icon: <Inbox className="size-4" />, label: "Assign Work", count: incoming.length },
        ]).map(({ id, icon, label, count }) => (
          <button
            key={id} onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              tab === id ? "bg-card text-foreground shadow-sm border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {icon} {label}
            <span className={cn("flex h-5 min-w-5 px-1 items-center justify-center rounded-full text-[10px] font-bold",
              tab === id ? "bg-primary/15 text-primary" : "bg-muted-foreground/15")}>{count}</span>
          </button>
        ))}
      </div>

      {/* Review tab */}
      {tab === "review" && (
        review.length === 0 ? (
          <Empty icon={<CheckCircle2 className="size-10" />} title="No pending reviews" sub="Submissions from your team will appear here." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {review.map((t) => (
              <ReviewCard key={t.id} task={t} teamName={teamsById.get(t.team_id || "")?.name ?? ""} onReedit={setReeditTask} />
            ))}
          </div>
        )
      )}

      {/* Assign tab */}
      {tab === "assign" && (
        incoming.length === 0 ? (
          <Empty icon={<Inbox className="size-10" />} title="No new work to assign" sub="New unassigned tasks in your teams show up here." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {incoming.map((t) => (
              <AssignCard key={t.id} task={t} team={teamsById.get(t.team_id || "")} />
            ))}
          </div>
        )
      )}

      <AnimatePresence>
        {reeditTask && <ReeditModal task={reeditTask} onClose={() => setReeditTask(null)} />}
      </AnimatePresence>
    </div>
  );
}

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 rounded-2xl border bg-card text-muted-foreground/60">
      {icon}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs">{sub}</p>
    </div>
  );
}
