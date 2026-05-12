"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateTask } from "@/hooks/useProjects";
import type { TaskPriority, TaskStatus } from "@/types/project";
import { COLUMNS } from "@/types/project";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultStatus?: TaskStatus;
}

export function AddTaskModal({ open, onClose, defaultStatus = "pending" }: Props) {
  const create = useCreateTask();
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [priority, setPriority]     = useState<TaskPriority>("medium");
  const [status, setStatus]         = useState<TaskStatus>(defaultStatus);
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate]       = useState("");

  function reset() {
    setTitle(""); setDesc(""); setPriority("medium");
    setStatus(defaultStatus); setAssignedTo(""); setDueDate("");
  }

  function close() { reset(); onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({
      title: title.trim(),
      description,
      priority,
      status,
      assigned_to: assignedTo,
      due_date: dueDate || null,
    });
    close();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal */}
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
              className="pointer-events-auto w-full max-w-lg rounded-2xl border bg-card shadow-2xl flex flex-col gap-4 p-6"
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
                  <input
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                    placeholder="Name..."
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition"
                  />
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

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!title.trim() || create.isPending}>
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
