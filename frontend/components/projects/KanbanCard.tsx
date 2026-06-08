"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Calendar, GripVertical, Paperclip, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeleteTask, useUpdateTask } from "@/hooks/useProjects";
import { useCanApprove } from "@/hooks/useCanApprove";
import type { Task, TaskStatus } from "@/types/project";
import { BOARD_COLUMNS, PRIORITY_META, isTaskOverdue, assigneeLabel, allowedColumns } from "@/types/project";

interface Props {
  task: Task;
  overlay?: boolean;
}

export function KanbanCard({ task, overlay = false }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // Suppress transition while actively dragging — prevents rubber-band jitter
    transition: isDragging ? "none" : transition,
    touchAction: "none",
    willChange: "transform",
  };

  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const canApprove = useCanApprove();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // In Pending Review only a team leader / admin may move the task
  // (approve or rework). Everyone else sees it locked.
  const reviewLocked = task.status === "pending_review" && !canApprove(task);
  const statusOptions = reviewLocked
    ? BOARD_COLUMNS.filter((c) => c.key === "pending_review")
    : allowedColumns(task.status);

  const meta = PRIORITY_META[task.priority];
  const isOverdue = isTaskOverdue(task);
  const attachmentCount = task.attachments?.length ?? 0;
  const assignee = assigneeLabel(task);

  function handleStatusChange(s: TaskStatus) {
    updateTask.mutate({ id: task.id, payload: { status: s } });
  }

  // ── Dragging: render a clean placeholder slot so the column keeps its shape ──
  // The actual card travels with the cursor via DragOverlay in KanbanBoard.
  if (isDragging && !overlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="min-h-[104px] rounded-xl border-2 border-dashed border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.06]"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Entire card surface is the drag handle — much more ergonomic than grip-only
      {...attributes}
      {...listeners}
      className={cn(
        "group relative rounded-xl border bg-card p-3.5 shadow-sm select-none",
        "cursor-grab active:cursor-grabbing transition-shadow duration-150",
        overlay
          ? "shadow-2xl rotate-[1.5deg] scale-[1.04] ring-2 ring-primary/30 cursor-grabbing"
          : "hover:shadow-md hover:border-primary/20",
        // Overdue tasks get a red border + subtle red wash
        isOverdue && !overlay &&
          "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 hover:border-red-400"
      )}
    >
      {/* Priority badge + grip icon (visual only — listeners are on the outer div) */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/25 pointer-events-none" />
        <div className="flex items-center gap-1.5">
          {isOverdue && (
            <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-900/50 dark:text-red-400">
              <AlertTriangle className="size-2.5" /> Overdue
            </span>
          )}
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.color)}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Title */}
      <p className="text-sm font-medium leading-snug text-foreground mb-1.5 pl-6">
        {task.title}
      </p>

      {/* Description */}
      {task.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 pl-6 mb-2">
          {task.description}
        </p>
      )}

      {/* Reedit reason — visible to the assignee so they know what to fix */}
      {task.status === "reedit" && task.reedit_reason && (
        <div className="ml-6 mb-2 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1.5">
          <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">Sent to reedit</p>
          <p className="text-[11px] text-foreground/80 leading-snug">{task.reedit_reason}</p>
        </div>
      )}

      {/* Meta chips — wrap, never overlap */}
      {(assignee || task.due_date || attachmentCount > 0) && (
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 pl-6 mt-2">
          {/* Assignee */}
          {assignee && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
              <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[9px]">
                {assignee[0]?.toUpperCase()}
              </div>
              <span className="truncate max-w-[70px]">{assignee}</span>
            </div>
          )}

          {/* Due date */}
          {task.due_date && (
            <div className={cn(
              "flex items-center gap-0.5 text-[10px] shrink-0",
              isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"
            )}>
              <Calendar className="size-3" />
              {new Date(task.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
          )}

          {/* Attachments count */}
          {attachmentCount > 0 && (
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
              <Paperclip className="size-3" />
              {attachmentCount}
            </div>
          )}
        </div>
      )}

      {/* Status quick-switch on its own row — full width, no overlap */}
      <div className="pl-6 mt-2">
        <select
          value={task.status}
          onChange={e => handleStatusChange(e.target.value as TaskStatus)}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          disabled={reviewLocked}
          title={reviewLocked ? "Only a team leader can approve or rework this" : undefined}
          className="w-full rounded-md border-0 bg-muted/50 px-2 py-1 text-[10px] font-medium outline-none cursor-pointer hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-70"
        >
          {statusOptions.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Delete button — stopPropagation so it doesn't trigger a drag */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          if (confirmDelete) {
            deleteTask.mutate(task.id);
            setConfirmDelete(false);
          } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 2500);
          }
        }}
        className={cn(
          "absolute top-2 right-2 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-all",
          confirmDelete
            ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 opacity-100"
            : "text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
        )}
        title={confirmDelete ? "Click again to confirm" : "Delete task"}
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}
