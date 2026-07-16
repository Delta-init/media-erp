"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, CheckCircle2, RotateCcw, Inbox, UserPlus,
  Loader2, X, Calendar, Crown, ChevronDown, Paperclip,
  MessageSquare, Eye, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeaderQueue, useUpdateTask, type LeaderTeam } from "@/hooks/useProjects";
import { useAllTeams } from "@/hooks/useTeams";
import { TaskDetailModal } from "@/components/projects/TaskDetailModal";
import { useAuthStore } from "@/stores/authStore";
import type { Task } from "@/types/project";
import { PRIORITY_META, isTaskOverdue, assigneeLabel } from "@/types/project";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fmtDateOnly } from "@/lib/datetime";

type Tab = "review" | "assign" | "reedit";

// ── Reedit reason modal ───────────────────────────────────────────────────────

function ReeditModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const update = useUpdateTask();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    const payload: Record<string, string> = { status: "reedit", reedit_reason: reason.trim() };
    await update.mutateAsync({ id: task.id, payload });
    toast.success("Task sent to reedit");
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
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Task: <span className="font-medium text-foreground">{task.title}</span>
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for reedit *</label>
            <textarea
              autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
              placeholder="Explain what needs to change so the original team knows how to fix it…"
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!reason.trim() || update.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white">
              {update.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <RotateCcw className="size-4 mr-1.5" />}
              Send to Reedit
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Approve + route modal ─────────────────────────────────────────────────────

function ApproveRouteModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [destTeamId, setDestTeamId] = useState("");
  const update = useUpdateTask();
  const { data: allTeams = [] } = useAllTeams();

  async function confirm() {
    const payload: Record<string, string> = { status: "approved" };
    if (destTeamId) payload.destination_team_id = destTeamId;
    await update.mutateAsync({ id: task.id, payload });
    if (destTeamId) {
      const teamName = allTeams.find((t) => t.id === destTeamId)?.name ?? "the selected team";
      toast.success(`Approved — sent to ${teamName}'s Leader Desk`);
    } else {
      toast.success("Task approved");
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl border bg-card shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-600" />
            <h2 className="text-sm font-semibold">Approve Task</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="size-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Task: <span className="font-medium text-foreground">{task.title}</span>
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Route to team <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <p className="text-xs text-muted-foreground">
              A copy of this task will appear in the selected team&apos;s incoming queue.
            </p>
            <div className="relative">
              <select
                value={destTeamId}
                onChange={(e) => setDestTeamId(e.target.value)}
                className="w-full appearance-none rounded-lg border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="">No routing — approve only</option>
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t px-5 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={confirm} disabled={update.isPending} className="bg-green-600 hover:bg-green-700 text-white">
            {update.isPending
              ? <Loader2 className="size-4 animate-spin mr-1.5" />
              : <CheckCircle2 className="size-4 mr-1.5" />}
            {destTeamId ? "Approve & Route" : "Approve"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({
  task, teamName, onReedit, onApprove,
}: {
  task: Task;
  teamName: string;
  onReedit: (t: Task) => void;
  onApprove: (t: Task) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const pri = PRIORITY_META[task.priority];
  const overdue = isTaskOverdue(task);
  const attachmentCount = task.attachments?.length ?? 0;

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex-1 text-left px-4 pt-4 pb-3 hover:bg-muted/20 transition-colors group/card"
        >
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <p className="text-sm font-semibold leading-snug flex-1 group-hover/card:text-primary transition-colors">
              {task.title}
            </p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", pri.color)}>
              {pri.label}
            </span>
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
          )}

          {task.caption && (
            <div className="mb-2 rounded-md border border-purple-400/30 bg-purple-500/5 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 mb-0.5">
                <MessageSquare className="size-3" /> Submission Note
              </p>
              <p className="text-xs text-foreground/80 line-clamp-2">{task.caption}</p>
            </div>
          )}

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
                {fmtDateOnly(task.due_date, { day: "numeric", month: "short" })}
              </span>
            )}
            {attachmentCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Paperclip className="size-3" /> {attachmentCount}
              </span>
            )}
          </div>
        </button>

        <div className="border-t px-4 py-3 flex gap-2">
          <Button
            size="sm" variant="outline"
            onClick={() => setDetailOpen(true)}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Eye className="size-3.5" /> View
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onApprove(task)}
          >
            <CheckCircle2 className="size-4 mr-1.5" /> Approve
          </Button>
          <Button
            size="sm" variant="outline"
            className="flex-1 border-rose-400/40 text-rose-600 hover:bg-rose-500/10"
            onClick={() => onReedit(task)}
          >
            <RotateCcw className="size-4 mr-1.5" /> Reedit
          </Button>
        </div>
      </div>

      {detailOpen && (
        <TaskDetailModal
          task={task}
          teamName={teamName}
          readOnly
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}

// ── Assign card ───────────────────────────────────────────────────────────────

function AssignCard({
  task, team, onReedit,
}: {
  task: Task;
  team?: LeaderTeam;
  onReedit: (t: Task) => void;
}) {
  const update = useUpdateTask();
  const [memberId, setMemberId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const pri = PRIORITY_META[task.priority];
  const myId = useAuthStore((s) => s.user)?.id ?? "";

  async function assign() {
    if (!memberId) return;
    const m = team?.members.find((x) => x.id === memberId);
    const name = m?.name ?? "";
    await update.mutateAsync({
      id: task.id,
      payload: { assigned_to: memberId, assigned_to_name: name },
    });
    // A leader may assign work to themselves — say so explicitly.
    toast.success(memberId === myId ? `Assigned to you — "${task.title}"` : `Assigned to ${name}`);
    setMemberId("");
  }

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex-1 text-left px-4 pt-4 pb-3 hover:bg-muted/20 transition-colors group/card"
        >
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <p className="text-sm font-semibold leading-snug flex-1 group-hover/card:text-primary transition-colors">
              {task.title}
            </p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", pri.color)}>
              {pri.label}
            </span>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
          )}
          {task.former_team_name && (
            <div className="mb-2 rounded-md border border-amber-400/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
              Routed from <span className="font-semibold">{task.former_team_name}</span>
              {task.former_assigned_to_name && (
                <> · worked by <span className="font-semibold">{task.former_assigned_to_name}</span></>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {team?.name && <span className="rounded-full bg-muted px-2 py-0.5">{team.name}</span>}
            {assigneeLabel(task)
              ? <span>Assigned: {assigneeLabel(task)}</span>
              : <span className="italic text-muted-foreground/60">Unassigned</span>
            }
          </div>
        </button>

        <div className="border-t px-4 py-3 flex gap-2 flex-wrap">
          <Button
            size="sm" variant="outline"
            onClick={() => setDetailOpen(true)}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Eye className="size-3.5" /> View
          </Button>
          <Button
            size="sm" variant="outline"
            className="border-rose-400/40 text-rose-600 hover:bg-rose-500/10"
            onClick={() => onReedit(task)}
          >
            <RotateCcw className="size-3.5 mr-1" /> Reedit
          </Button>
          <div className="flex flex-1 gap-2 min-w-0">
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
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
      </div>

      {detailOpen && (
        <TaskDetailModal
          task={task}
          teamName={team?.name}
          readOnly
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}

// ── Reedit card ───────────────────────────────────────────────────────────────

function ReeditCard({ task, team }: { task: Task; team?: LeaderTeam }) {
  const update = useUpdateTask();
  const [memberId, setMemberId] = useState(task.assigned_to || "");
  const [detailOpen, setDetailOpen] = useState(false);
  const pri = PRIORITY_META[task.priority];

  function assign() {
    if (!memberId) return;
    const m = team?.members.find((x) => x.id === memberId);
    update.mutate({
      id: task.id,
      payload: { assigned_to: memberId, assigned_to_name: m?.name ?? "", status: "started" },
    });
    toast.success("Task assigned and started");
  }

  return (
    <>
      <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-card shadow-sm overflow-hidden flex flex-col">
        {/* Red top stripe */}
        <div className="h-1 bg-gradient-to-r from-rose-500 to-orange-400" />

        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex-1 text-left px-4 pt-3 pb-3 hover:bg-muted/20 transition-colors group/card"
        >
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <p className="text-sm font-semibold leading-snug flex-1 group-hover/card:text-primary transition-colors">
              {task.title}
            </p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", pri.color)}>
              {pri.label}
            </span>
          </div>

          {/* Reedit reason — most prominent element */}
          {task.reedit_reason && (
            <div className="mb-2 rounded-md border border-rose-400/30 bg-rose-500/5 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mb-1">
                <AlertTriangle className="size-3" /> Reedit Reason
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">{task.reedit_reason}</p>
            </div>
          )}

          {task.former_team_name && (
            <div className="mb-2 rounded-md border border-amber-400/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
              Returned by <span className="font-semibold">{task.former_team_name}</span>
              {task.former_assigned_to_name && (
                <> · originally worked by <span className="font-semibold">{task.former_assigned_to_name}</span></>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {team?.name && <span className="rounded-full bg-muted px-2 py-0.5">{team.name}</span>}
          </div>
        </button>

        <div className="border-t px-4 py-3 flex gap-2">
          <Button
            size="sm" variant="outline"
            onClick={() => setDetailOpen(true)}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Eye className="size-3.5" /> View
          </Button>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="">Assign to…</option>
            {team?.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.role === "leader" ? " (leader)" : ""}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={assign}
            disabled={!memberId || update.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          </Button>
        </div>
      </div>

      {detailOpen && (
        <TaskDetailModal
          task={task}
          teamName={team?.name}
          readOnly
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeaderPage() {
  const { data, isLoading } = useLeaderQueue();
  const [tab, setTab] = useState<Tab>("review");
  const [reeditTask, setReeditTask] = useState<Task | null>(null);
  const [approveTask, setApproveTask] = useState<Task | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const teamsById = useMemo(() => {
    const m = new Map<string, LeaderTeam>();
    (data?.teams ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [data]);

  const teamsList = data?.teams ?? [];

  const review = useMemo(() => {
    const all = data?.review ?? [];
    if (!selectedTeamId) return all;
    return all.filter((t) => t.team_id === selectedTeamId);
  }, [data, selectedTeamId]);

  const incoming = data?.incoming ?? [];
  const reeditList = data?.reedit ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
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

  const tabs: { id: Tab; icon: React.ReactNode; label: string; count: number; danger?: boolean }[] = [
    { id: "review", icon: <ClipboardCheck className="size-4" />, label: "Pending Reviews", count: review.length },
    { id: "assign", icon: <Inbox className="size-4" />, label: "Assign Work",     count: incoming.length },
    { id: "reedit", icon: <RotateCcw className="size-4" />, label: "Reedit",       count: reeditList.length, danger: true },
  ];

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
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 border w-fit max-w-full overflow-x-auto">
        {tabs.map(({ id, icon, label, count, danger }) => (
          <button
            key={id} onClick={() => setTab(id)}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all sm:px-4",
              tab === id ? "bg-card text-foreground shadow-sm border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {icon} {label}
            {count > 0 && (
              <span className={cn(
                "flex h-5 min-w-5 px-1 items-center justify-center rounded-full text-[10px] font-bold",
                danger && count > 0
                  ? tab === id ? "bg-rose-500/20 text-rose-600" : "bg-rose-500/15 text-rose-500"
                  : tab === id ? "bg-primary/15 text-primary" : "bg-muted-foreground/15"
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Team filter (review tab) */}
      {tab === "review" && teamsList.length > 1 && (
        <div className="flex items-center gap-2.5">
          <span className="text-sm text-muted-foreground shrink-0">Team</span>
          <div className="relative">
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="appearance-none rounded-lg border bg-card px-3 py-1.5 pr-8 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 cursor-pointer"
            >
              <option value="">All teams</option>
              {teamsList.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          </div>
          {selectedTeamId && (
            <button
              onClick={() => setSelectedTeamId("")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Review tab */}
      {tab === "review" && (
        review.length === 0 ? (
          <Empty
            icon={<CheckCircle2 className="size-10" />}
            title="No pending reviews"
            sub="Submissions from your team will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {review.map((t) => (
              <ReviewCard
                key={t.id}
                task={t}
                teamName={teamsById.get(t.team_id || "")?.name ?? ""}
                onReedit={setReeditTask}
                onApprove={setApproveTask}
              />
            ))}
          </div>
        )
      )}

      {/* Assign tab */}
      {tab === "assign" && (
        incoming.length === 0 ? (
          <Empty
            icon={<Inbox className="size-10" />}
            title="No new work to assign"
            sub="New unassigned tasks in your teams show up here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {incoming.map((t) => (
              <AssignCard key={t.id} task={t} team={teamsById.get(t.team_id || "")} onReedit={setReeditTask} />
            ))}
          </div>
        )
      )}

      {/* Reedit tab */}
      {tab === "reedit" && (
        reeditList.length === 0 ? (
          <Empty
            icon={<RotateCcw className="size-10" />}
            title="No reedit tasks"
            sub="Tasks returned for revision will appear here with the reedit reason."
          />
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-400/20 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              These tasks were returned for revision. Read the reason, then assign to an employee to fix.
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reeditList.map((t) => (
                <ReeditCard key={t.id} task={t} team={teamsById.get(t.team_id || "")} />
              ))}
            </div>
          </>
        )
      )}

      <AnimatePresence>
        {reeditTask && <ReeditModal task={reeditTask} onClose={() => setReeditTask(null)} />}
        {approveTask && (
          <ApproveRouteModal task={approveTask} onClose={() => setApproveTask(null)} />
        )}
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
