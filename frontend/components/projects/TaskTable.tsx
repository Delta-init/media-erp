"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, Calendar, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeleteTask, useUpdateTask } from "@/hooks/useProjects";
import type { Task, TaskPriority, TaskStatus } from "@/types/project";
import { COLUMNS, PRIORITY_META } from "@/types/project";
import { listItemVariants, listVariants } from "@/lib/animations";

type SortKey = "title" | "status" | "priority" | "due_date" | "created_at";

interface Props { tasks: Task[] }

export function TaskTable({ tasks }: Props) {
  const [sortKey, setSortKey]   = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc]   = useState(false);
  const updateTask  = useUpdateTask();
  const deleteTask  = useDeleteTask();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortAsc(p => !p);
    else { setSortKey(k); setSortAsc(true); }
  }

  const sorted = [...tasks].sort((a, b) => {
    let av = a[sortKey] ?? "";
    let bv = b[sortKey] ?? "";
    const cmp = String(av).localeCompare(String(bv));
    return sortAsc ? cmp : -cmp;
  });

  function Th({ k, label }: { k: SortKey; label: string }) {
    return (
      <th
        onClick={() => toggleSort(k)}
        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-1">
          {label}
          <ArrowUpDown className={cn("size-3", sortKey === k ? "text-primary" : "opacity-40")} />
        </div>
      </th>
    );
  }

  function handleDelete(id: string) {
    if (confirmId === id) {
      deleteTask.mutate(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId(prev => prev === id ? null : prev), 2500);
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">No tasks found</p>
        <p className="text-xs mt-1">Add a task or adjust your filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/40 border-b">
          <tr>
            <Th k="title" label="Title" />
            <Th k="status" label="Status" />
            <Th k="priority" label="Priority" />
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assigned To
            </th>
            <Th k="due_date" label="Due Date" />
            <Th k="created_at" label="Created" />
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {sorted.map((task, i) => {
              const col = COLUMNS.find(c => c.id === task.status);
              const pri = PRIORITY_META[task.priority];
              const isOverdue = task.due_date && new Date(task.due_date) < new Date();

              return (
                <motion.tr
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.02 }}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors group"
                >
                  {/* Title + description */}
                  <td className="px-4 py-3 max-w-[240px]">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{task.description}</p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <select
                      value={task.status}
                      onChange={e =>
                        updateTask.mutate({ id: task.id, payload: { status: e.target.value as TaskStatus } })
                      }
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold border-0 outline-none cursor-pointer",
                        col?.color, col?.bg
                      )}
                    >
                      {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-3">
                    <select
                      value={task.priority}
                      onChange={e =>
                        updateTask.mutate({ id: task.id, payload: { priority: e.target.value as TaskPriority } })
                      }
                      className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold border-0 outline-none cursor-pointer", pri.color)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </td>

                  {/* Assigned to */}
                  <td className="px-4 py-3">
                    {task.assigned_to ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[9px]">
                          {task.assigned_to[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs text-muted-foreground">{task.assigned_to}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Due date */}
                  <td className="px-4 py-3">
                    {task.due_date ? (
                      <span className={cn("flex items-center gap-1 text-xs", isOverdue ? "text-red-500" : "text-muted-foreground")}>
                        <Calendar className="size-3" />
                        {new Date(task.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* Created at */}
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(task.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </td>

                  {/* Delete */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(task.id)}
                      className={cn(
                        "rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-all",
                        confirmId === task.id
                          ? "bg-red-100 text-red-600 dark:bg-red-900/50 opacity-100"
                          : "text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                      )}
                      title={confirmId === task.id ? "Click again to confirm" : "Delete"}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
