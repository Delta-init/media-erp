"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  X, Paperclip, Upload, Loader2,
  File as FileIcon, FileText, FileImage, FileVideo,
  Trash2, CheckCircle2, Send, Users, Calendar, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateTask } from "@/hooks/useProjects";
import { useUploadAttachments } from "@/hooks/useUpload";
import { useTeams } from "@/hooks/useTeams";
import type { Task, Attachment } from "@/types/project";
import { PRIORITY_META, BOARD_COLUMNS, assigneeLabel } from "@/types/project";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  task: Task;
  teamName?: string;
  readOnly?: boolean;
  onClose: () => void;
}

function fileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return <FileImage className="size-4 text-blue-500" />;
  if (contentType.startsWith("video/")) return <FileVideo className="size-4 text-purple-500" />;
  if (
    contentType.includes("pdf") ||
    contentType.includes("document") ||
    contentType.includes("text")
  )
    return <FileText className="size-4 text-orange-500" />;
  return <FileIcon className="size-4 text-muted-foreground" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  const teamName = teamNameProp ?? teams.find((t) => t.id === task.team_id)?.name;

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

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const uploaded = await upload.mutateAsync(Array.from(fileList));
    setAttachments((prev) => [...prev, ...uploaded]);
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
            <span className="text-xs font-medium" style={{ color: statusColor }}>
              {statusLabel}
            </span>
            <span className="text-xs text-muted-foreground/40">·</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.color)}>
              {meta.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Meta chips */}
          {(teamName || assignee || task.due_date) && (
            <div className="flex flex-wrap gap-2">
              {teamName && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Users className="size-3" /> {teamName}
                </span>
              )}
              {assignee && (
                <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary font-medium">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                    {assignee[0]?.toUpperCase()}
                  </span>
                  {assignee}
                </span>
              )}
              {task.due_date && (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Calendar className="size-3" />
                  {new Date(task.due_date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          {readOnly ? (
            <h3 className="text-base font-semibold leading-snug">{task.title}</h3>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
              />
            </div>
          )}

          {/* Description */}
          {readOnly ? (
            task.description ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            ) : null
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDesc(e.target.value);
                  setDirty(true);
                }}
                rows={3}
                placeholder="Add more context..."
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
              />
            </div>
          )}

          {/* Submission note */}
          {task.caption && (
            <div className="rounded-lg border border-purple-400/30 bg-purple-500/5 p-3 space-y-1">
              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <MessageSquare className="size-3" /> Submission Note
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {task.caption}
              </p>
            </div>
          )}

          {/* Attachments */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Paperclip className="size-3" />
              Attachments
              {attachments.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                  {attachments.length}
                </span>
              )}
            </p>

            {attachments.length > 0 ? (
              <div className="space-y-1.5">
                {attachments.map((a, i) => (
                  <div
                    key={a.key}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5"
                  >
                    {fileIcon(a.content_type)}
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
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          setAttachments((prev) => prev.filter((_, idx) => idx !== i));
                          setDirty(true);
                        }}
                        className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">No attachments yet</p>
            )}

            {!readOnly && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={upload.isPending}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed py-2.5 text-xs transition-colors",
                    upload.isPending
                      ? "opacity-60 pointer-events-none border-border"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  {upload.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="size-4 text-muted-foreground" /> Add media or files
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Caption input — appears after "Submit for Review" is clicked */}
          {!readOnly && showCaptionInput && (
            <div className="space-y-1.5 rounded-lg border border-purple-400/30 bg-purple-500/5 p-3">
              <label className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
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
        </div>

        {/* Footer (edit mode only) */}
        {!readOnly && (
          <div className="border-t px-5 py-4 flex items-center justify-between gap-3">
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
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              {dirty && !showCaptionInput && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={save}
                  disabled={update.isPending || !title.trim()}
                >
                  {update.isPending && !showCaptionInput ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : null}
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
                  {update.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="size-4 mr-1.5" />
                  )}
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
}
