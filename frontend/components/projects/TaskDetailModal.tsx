"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Paperclip, Upload, Loader2,
  File as FileIcon, FileText, FileVideo,
  Trash2, CheckCircle2, Send, Users, Calendar,
  MessageSquare, ArrowRight, UserCircle2, ExternalLink,
  History, ClipboardCheck, Play, Pause, RotateCcw,
  UserPlus, GitBranch, Circle, AlertTriangle, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateTask, useTaskDetail } from "@/hooks/useProjects";
import { TaskHistoryReport } from "@/components/projects/TaskHistoryReport";
import { useUploadAttachments } from "@/hooks/useUpload";
import { useTeams } from "@/hooks/useTeams";
import type { Task, Attachment, TaskHistoryEntry } from "@/types/project";
import { PRIORITY_META, BOARD_COLUMNS, assigneeLabel } from "@/types/project";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  task: Task;
  teamName?: string;
  readOnly?: boolean;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── History helpers ───────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  created:        { label: "Task Created",          icon: <Circle className="size-3.5" />,       color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
  assigned:       { label: "Assigned",               icon: <UserPlus className="size-3.5" />,     color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30" },
  started:        { label: "Work Started",           icon: <Play className="size-3.5" />,         color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" },
  break:          { label: "Paused",                 icon: <Pause className="size-3.5" />,        color: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
  pending_review: { label: "Submitted for Review",   icon: <Send className="size-3.5" />,         color: "text-purple-600 bg-purple-500/10 border-purple-500/30" },
  approved:       { label: "Approved",               icon: <CheckCircle2 className="size-3.5" />, color: "text-green-600 bg-green-500/10 border-green-500/30" },
  reedit:         { label: "Sent for Revision",      icon: <RotateCcw className="size-3.5" />,    color: "text-rose-600 bg-rose-500/10 border-rose-500/30" },
  routed:         { label: "Routed to Team",         icon: <GitBranch className="size-3.5" />,    color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
};

function fmtHistoryTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function HistoryTimeline({ entries }: { entries: TaskHistoryEntry[] }) {
  if (!entries.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground/50">
        <History className="size-8" />
        <p className="text-xs">No history recorded yet</p>
      </div>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />

      <div className="space-y-0">
        {sorted.map((e, i) => {
          const m = ACTION_META[e.action] ?? {
            label: e.action,
            icon: <Circle className="size-3.5" />,
            color: "text-muted-foreground bg-muted border-border",
          };
          return (
            <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Icon bubble */}
              <div className={cn(
                "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border",
                m.color
              )}>
                {m.icon}
              </div>

              {/* Content */}
              <div className="flex-1 pt-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="text-sm font-semibold leading-tight">{m.label}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 leading-tight">
                    {fmtHistoryTime(e.timestamp)}
                  </span>
                </div>

                {/* Actor */}
                {e.actor_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by <span className="font-medium text-foreground">{e.actor_name}</span>
                  </p>
                )}

                {/* Status transition */}
                {e.from_status && e.to_status && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusChip status={e.from_status} />
                    <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                    <StatusChip status={e.to_status} />
                  </div>
                )}

                {/* Note (reedit reason, assignment note, etc.) */}
                {e.note && (
                  <div className={cn(
                    "mt-1.5 rounded-md border px-2.5 py-1.5 text-xs leading-relaxed",
                    e.action === "reedit"
                      ? "border-rose-400/30 bg-rose-500/5 text-rose-700 dark:text-rose-400"
                      : "border-border bg-muted/30 text-foreground/70"
                  )}>
                    {e.action === "reedit" && (
                      <span className="flex items-center gap-1 font-semibold mb-0.5 text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="size-3" /> Reason
                      </span>
                    )}
                    {e.note}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const col = BOARD_COLUMNS.find((c) => c.key === status);
  const label = col?.label ?? status;
  const color = col?.color ?? "#6366f1";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold border"
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
    >
      {label}
    </span>
  );
}

// ── Attachment renderer ───────────────────────────────────────────────────────

function AttachmentList({
  attachments,
  readOnly,
  onRemove,
}: {
  attachments: Attachment[];
  readOnly: boolean;
  onRemove?: (i: number) => void;
}) {
  if (attachments.length === 0)
    return <p className="text-xs text-muted-foreground/50 italic">No attachments yet</p>;

  const images = attachments.filter((a) => a.content_type.startsWith("image/"));
  const others = attachments.filter((a) => !a.content_type.startsWith("image/"));

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((a) => {
            const globalIdx = attachments.indexOf(a);
            return (
              <div key={a.key} className="group relative aspect-square">
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.filename}
                    className="w-full h-full rounded-lg object-cover border border-border hover:brightness-90 transition"
                  />
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <ExternalLink className="size-4 text-white drop-shadow" />
                  </span>
                </a>
                {!readOnly && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(globalIdx)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100 transition hover:bg-destructive"
                  >
                    <X className="size-2.5 text-white" />
                  </button>
                )}
                <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/40 px-1 py-0.5 text-[9px] text-white truncate">
                  {a.filename}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-1.5">
          {others.map((a) => {
            const globalIdx = attachments.indexOf(a);
            const isVideo = a.content_type.startsWith("video/");
            const isPdf =
              a.content_type.includes("pdf") ||
              a.content_type.includes("document") ||
              a.content_type.includes("text");
            return (
              <div
                key={a.key}
                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5"
              >
                {isVideo ? (
                  <FileVideo className="size-4 text-purple-500 shrink-0" />
                ) : isPdf ? (
                  <FileText className="size-4 text-orange-500 shrink-0" />
                ) : (
                  <FileIcon className="size-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium truncate block hover:underline"
                  >
                    {a.filename}
                  </a>
                  <span className="text-[10px] text-muted-foreground">{formatSize(a.size)}</span>
                </div>
                {!readOnly && onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(globalIdx)}
                    className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

type ModalTab = "details" | "history";

export function TaskDetailModal({
  task,
  teamName: teamNameProp,
  readOnly = false,
  onClose,
}: Props) {
  const update = useUpdateTask();
  const upload = useUploadAttachments();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: teams = [] } = useTeams();
  const { data: taskDetail, isLoading: historyLoading } = useTaskDetail(task.id);

  const teamName = teamNameProp ?? teams.find((t) => t.id === task.team_id)?.name;

  const [activeTab, setActiveTab] = useState<ModalTab>("details");
  const [showReport, setShowReport] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDesc] = useState(task.description || "");
  const [attachments, setAttachments] = useState<Attachment[]>(task.attachments ?? []);
  const [caption, setCaption] = useState("");
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [dirty, setDirty] = useState(false);

  const meta = PRIORITY_META[task.priority];
  const statusColor = BOARD_COLUMNS.find((c) => c.key === task.status)?.color ?? "#6366f1";
  const statusLabel = BOARD_COLUMNS.find((c) => c.key === task.status)?.label ?? task.status;
  const canSubmitForReview = ["started", "reedit"].includes(task.status);
  const assignee = assigneeLabel(task);

  // Use live-fetched history if available, fall back to task.history
  const historyEntries = taskDetail?.history ?? task.history ?? [];

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const uploaded = await upload.mutateAsync(Array.from(fileList));
    setAttachments((prev) => [...prev, ...uploaded]);
    setDirty(true);
  }

  function removeAttachment(i: number) {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  async function save() {
    await update.mutateAsync({
      id: task.id,
      payload: { title: title.trim(), description, attachments },
    });
    setDirty(false);
    toast.success("Task saved");
  }

  async function submitForReview() {
    if (!caption.trim()) return;
    await update.mutateAsync({
      id: task.id,
      payload: {
        title: title.trim(),
        description,
        attachments,
        status: "pending_review",
        caption: caption.trim(),
      },
    });
    toast.success("Submitted for review");
    onClose();
  }

  const tabs: { id: ModalTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "details", label: "Details",  icon: <ClipboardCheck className="size-3.5" /> },
    { id: "history", label: "History",  icon: <History className="size-3.5" />, badge: historyEntries.length || undefined },
  ];

  const modal = createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="w-full max-w-xl max-h-[92vh] overflow-hidden rounded-2xl border bg-card shadow-2xl flex flex-col"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="shrink-0 size-2.5 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <span className="text-xs font-semibold" style={{ color: statusColor }}>
              {statusLabel}
            </span>
            <span className="text-muted-foreground/30 text-xs">·</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", meta.color)}>
              {meta.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-0.5 border-b px-5 pt-2 shrink-0 bg-card">
          {tabs.map(({ id, label, icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {icon} {label}
              {badge !== undefined && (
                <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "details" ? (
              <motion.div
                key="details"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="p-5 flex flex-col gap-5"
              >
                {/* Task title */}
                {readOnly ? (
                  <h2 className="text-lg font-bold leading-snug">{task.title}</h2>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Title</label>
                    <input
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                    />
                  </div>
                )}

                {/* Who & where */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <UserCircle2 className="size-3" /> Worked by
                    </p>
                    {assignee ? (
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                          {assignee[0]?.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium truncate">{assignee}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Unassigned</p>
                    )}
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Users className="size-3" /> Team
                    </p>
                    <p className="text-sm font-medium truncate">{teamName || "—"}</p>
                  </div>
                </div>

                {/* Routed from provenance */}
                {(task.former_assigned_to_name || task.former_team_name) && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                      Routed from
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      {task.former_team_name && (
                        <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          {task.former_team_name}
                        </span>
                      )}
                      {task.former_assigned_to_name && task.former_team_name && (
                        <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      {task.former_assigned_to_name && (
                        <div className="flex items-center gap-1.5">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[9px] font-bold">
                            {task.former_assigned_to_name[0]?.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium">{task.former_assigned_to_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Due date */}
                {task.due_date && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="size-3.5" />
                    Due{" "}
                    <span className="font-medium text-foreground">
                      {new Date(task.due_date).toLocaleDateString("en-GB", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </span>
                  </div>
                )}

                {/* Description */}
                {readOnly ? (
                  task.description ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</p>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap bg-muted/20 rounded-xl p-3 border">
                        {task.description}
                      </p>
                    </div>
                  ) : null
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => { setDesc(e.target.value); setDirty(true); }}
                      rows={3}
                      placeholder="Add more context..."
                      className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                    />
                  </div>
                )}

                {/* Submission note */}
                {task.caption && (
                  <div className="rounded-xl border border-purple-400/30 bg-purple-500/5 p-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide flex items-center gap-1">
                      <MessageSquare className="size-3" /> Submission Note
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {task.caption}
                    </p>
                  </div>
                )}

                {/* Reedit reason */}
                {task.reedit_reason && (
                  <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 p-3 space-y-1.5">
                    <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide flex items-center gap-1">
                      <RotateCcw className="size-3" /> Reedit Reason
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {task.reedit_reason}
                    </p>
                  </div>
                )}

                {/* Media & Attachments */}
                <div className="space-y-2.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Paperclip className="size-3" /> Media &amp; Attachments
                    {attachments.length > 0 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground normal-case">
                        {attachments.length}
                      </span>
                    )}
                  </p>
                  <AttachmentList
                    attachments={attachments}
                    readOnly={readOnly}
                    onRemove={readOnly ? undefined : removeAttachment}
                  />
                  {!readOnly && (
                    <>
                      <input
                        ref={fileRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
                      />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={upload.isPending}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-xs font-medium transition-colors",
                          upload.isPending
                            ? "opacity-60 pointer-events-none border-border"
                            : "border-border hover:border-primary/50 hover:bg-muted/30"
                        )}
                      >
                        {upload.isPending ? (
                          <><Loader2 className="size-4 animate-spin" /> Uploading…</>
                        ) : (
                          <><Upload className="size-4 text-muted-foreground" /> Add media or files</>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* Caption input (submit for review flow) */}
                {!readOnly && showCaptionInput && (
                  <div className="space-y-1.5 rounded-xl border border-purple-400/30 bg-purple-500/5 p-3">
                    <label className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide flex items-center gap-1">
                      <MessageSquare className="size-3" /> Submission Note *
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Briefly explain what you completed or updated.
                    </p>
                    <textarea
                      autoFocus
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={3}
                      placeholder="e.g. Completed design mockups and updated the colour scheme…"
                      className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                    />
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="history"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <History className="size-4 text-muted-foreground" />
                    Task History
                  </h3>
                  <div className="flex items-center gap-2">
                    {historyLoading && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                    {historyEntries.length > 0 && !historyLoading && (
                      <button
                        onClick={() => setShowReport(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 transition-colors"
                      >
                        <BarChart2 className="size-3.5" /> View Report
                      </button>
                    )}
                  </div>
                </div>
                <HistoryTimeline entries={historyEntries} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer (edit mode only) ── */}
        {!readOnly && activeTab === "details" && (
          <div className="border-t px-5 py-4 flex items-center justify-between gap-3 shrink-0 bg-card">
            <div>
              {showCaptionInput && (
                <button
                  onClick={() => setShowCaptionInput(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              {dirty && !showCaptionInput && (
                <Button
                  size="sm" variant="outline"
                  onClick={save}
                  disabled={update.isPending || !title.trim()}
                >
                  {update.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                  Save
                </Button>
              )}
              {canSubmitForReview && !showCaptionInput && (
                <Button
                  size="sm"
                  onClick={() => setShowCaptionInput(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Send className="size-4 mr-1.5" /> Submit for Review
                </Button>
              )}
              {showCaptionInput && (
                <Button
                  size="sm"
                  onClick={submitForReview}
                  disabled={!caption.trim() || update.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {update.isPending
                    ? <Loader2 className="size-4 animate-spin mr-1.5" />
                    : <CheckCircle2 className="size-4 mr-1.5" />}
                  Confirm Submit
                </Button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );

  return (
    <>
      {modal}
      {showReport && (
        <TaskHistoryReport
          task={task}
          historyEntries={historyEntries}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}
