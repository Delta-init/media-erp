"use client";

import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, Paperclip, Upload, Loader2, File as FileIcon,
  FileText, FileImage, FileVideo, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateTask } from "@/hooks/useProjects";
import { useUploadAttachments } from "@/hooks/useUpload";
import { useTeams, useTeam } from "@/hooks/useTeams";
import { useUsersList } from "@/hooks/useUsers";
import type { TaskPriority, TaskStatus, Attachment } from "@/types/project";
import { COLUMNS } from "@/types/project";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultStatus?: TaskStatus;
  defaultTeamId?: string;
}

function fileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return <FileImage className="size-4 text-blue-500" />;
  if (contentType.startsWith("video/")) return <FileVideo className="size-4 text-purple-500" />;
  if (contentType.includes("pdf") || contentType.includes("document") || contentType.includes("text"))
    return <FileText className="size-4 text-orange-500" />;
  return <FileIcon className="size-4 text-muted-foreground" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AddTaskModal({ open, onClose, defaultStatus = "pending", defaultTeamId = "" }: Props) {
  const create = useCreateTask();
  const upload = useUploadAttachments();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [priority, setPriority]     = useState<TaskPriority>("medium");
  const [status, setStatus]         = useState<TaskStatus>(defaultStatus);
  const [teamId, setTeamId]         = useState(defaultTeamId);
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate]       = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Teams the current user belongs to
  const { data: teams = [] } = useTeams();
  // When a team is picked, fetch enriched member list for the assignee dropdown
  const { data: teamDetail } = useTeam(teamId);
  // Fallback: all users when no team selected
  const { data: usersData } = useUsersList({ limit: 100 });

  const assigneeOptions = useMemo(() => {
    if (teamId && teamDetail?.members) {
      return teamDetail.members.map((m) => ({ id: m.user_id, name: m.name || m.email }));
    }
    return (usersData?.users ?? []).map((u) => ({ id: u.id, name: u.name || u.email }));
  }, [teamId, teamDetail, usersData]);

  function reset() {
    setTitle(""); setDesc(""); setPriority("medium");
    setStatus(defaultStatus); setTeamId(defaultTeamId);
    setAssignedTo(""); setDueDate(""); setAttachments([]);
  }

  function close() { reset(); onClose(); }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const uploaded = await upload.mutateAsync(files);
    setAttachments((prev) => [...prev, ...uploaded]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const assigneeName = assigneeOptions.find(o => o.id === assignedTo)?.name ?? "";
    await create.mutateAsync({
      title: title.trim(),
      description,
      priority,
      status,
      team_id: teamId || null,
      assigned_to: assignedTo,
      assigned_to_name: assigneeName,
      due_date: dueDate || null,
      attachments,
    });
    close();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <form
              onSubmit={submit}
              className="pointer-events-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border bg-card shadow-2xl flex flex-col gap-4 p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                    <Plus className="size-4 text-primary" />
                  </div>
                  <h2 className="font-semibold text-base">Add Task</h2>
                </div>
                <button type="button" onClick={close} className="rounded-md p-1 hover:bg-muted transition-colors">
                  <X className="size-4 text-muted-foreground" />
                </button>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Optional details..."
                  rows={3}
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                />
              </div>

              {/* Team selector (only if user has teams) */}
              {teams.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Team</label>
                  <select
                    value={teamId}
                    onChange={e => { setTeamId(e.target.value); setAssignedTo(""); }}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                  >
                    <option value="">No team (personal)</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status + Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as TaskStatus)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                  >
                    {COLUMNS.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* Assigned To + Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Assigned To</label>
                  <select
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                  >
                    <option value="">Unassigned</option>
                    {assigneeOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                  />
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Paperclip className="size-3" /> Attachments
                </label>

                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
                />

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={upload.isPending}
                  className={cn(
                    "w-full flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-4 transition-colors",
                    upload.isPending
                      ? "opacity-60 pointer-events-none border-border"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  {upload.isPending ? (
                    <>
                      <Loader2 className="size-5 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-5 text-muted-foreground" />
                      <span className="text-xs font-medium">Click to upload files</span>
                      <span className="text-[10px] text-muted-foreground">Any type · up to 25 MB each · max 10 files</span>
                    </>
                  )}
                </button>

                {/* Uploaded files list */}
                {attachments.length > 0 && (
                  <div className="space-y-1.5 mt-1">
                    {attachments.map((a, i) => (
                      <div key={a.key} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
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
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!title.trim() || create.isPending || upload.isPending}>
                  {create.isPending ? "Creating…" : "Create Task"}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
