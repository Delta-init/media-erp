"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateTask } from "@/hooks/useProjects";
import { useStatuses, useDeleteStatus } from "@/hooks/useStatuses";
import { KanbanCard } from "./KanbanCard";
import { AddTaskModal } from "./AddTaskModal";
import { StatusColumnModal } from "./StatusColumnModal";
import type { Task, TaskStatus, BoardStatus } from "@/types/project";
import { statusStyles } from "@/types/project";
import { useDroppable } from "@dnd-kit/core";

// ── Drop animation — spring-like easing ──────────────────────────────────────
const dropAnimation: DropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
  }),
};

// ── Column ────────────────────────────────────────────────────────────────────
interface ColumnProps {
  status: BoardStatus;
  tasks: Task[];
  isOver: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

function KanbanColumn({ status, tasks, isOver, onAdd, onEdit, onDelete, canDelete }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: status.key });
  const s = statusStyles(status.color);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-col min-w-[256px] w-[256px] shrink-0">
      {/* Header — solid accent bar + controls always visible */}
      <div
        className="rounded-t-xl border border-b-0 px-3 py-2 flex items-center justify-between"
        style={{ ...s.headerBg, borderTop: `2px solid ${status.color}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2.5 rounded-full shrink-0" style={s.dot} />
          <span className="text-[11px] font-bold uppercase tracking-wider truncate" style={s.text}>
            {status.label}
          </span>
          <span
            className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold shrink-0"
            style={s.badgeBg}
          >
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onEdit}
            className="rounded-md p-1 opacity-60 hover:opacity-100 hover:bg-white/40 dark:hover:bg-black/25 transition-all"
            style={s.text}
            title="Edit column"
          >
            <Pencil className="size-3" />
          </button>
          {canDelete && (
            <button
              onClick={() => {
                if (confirmDelete) { onDelete(); setConfirmDelete(false); }
                else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 2500); }
              }}
              className={cn(
                "rounded-md p-1 transition-all hover:bg-white/40 dark:hover:bg-black/25",
                confirmDelete
                  ? "opacity-100 text-red-600 bg-red-100 dark:bg-red-900/40"
                  : "opacity-60 hover:opacity-100"
              )}
              style={confirmDelete ? undefined : s.text}
              title={confirmDelete ? "Click again to delete" : "Delete column"}
            >
              <Trash2 className="size-3" />
            </button>
          )}
          <button
            onClick={onAdd}
            className="rounded-md p-1 opacity-80 hover:opacity-100 hover:bg-white/40 dark:hover:bg-black/25 transition-all"
            style={s.text}
            title={`Add task to ${status.label}`}
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Drop zone — fixed height with internal scroll so many cards stay neat */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 rounded-b-xl border border-t-0 p-1.5 transition-colors duration-150",
          "h-[calc(100dvh-300px)] min-h-[160px] overflow-y-auto overflow-x-hidden",
          isOver ? "ring-2 ring-inset" : ""
        )}
        style={{
          backgroundColor: isOver ? `${status.color}14` : `${status.color}07`,
          borderColor: `${status.color}33`,
        }}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {tasks.map(task => (
              <motion.div
                key={task.id}
                layout
                layoutId={task.id}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                <KanbanCard task={task} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>

        {tasks.length === 0 && (
          <div className={cn(
            "flex flex-1 items-center justify-center rounded-lg border border-dashed p-6 transition-colors duration-150",
            isOver ? "border-primary/40 bg-primary/5" : "border-muted-foreground/15"
          )}>
            <p className="text-[11px] text-muted-foreground/50 text-center whitespace-pre-line">
              {isOver ? "Drop here" : "No tasks yet\nclick + to add"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────
interface Props { tasks: Task[] }

export function KanbanBoard({ tasks }: Props) {
  const updateTask = useUpdateTask();
  const deleteStatus = useDeleteStatus();
  const { data: statuses = [], isLoading: statusesLoading } = useStatuses();

  // Local copy for optimistic real-time ordering
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<TaskStatus | null>(null);
  const [addStatus, setAddStatus]     = useState<TaskStatus>("pending");
  const [addOpen, setAddOpen]         = useState(false);

  // Column management modals
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [editingStatus, setEditingStatus]     = useState<BoardStatus | undefined>(undefined);

  useEffect(() => {
    if (!activeTask) setLocalTasks(tasks);
  }, [tasks, activeTask]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const validStatuses = statuses.map(s => s.key);

  function resolveColumn(overId: string): TaskStatus | null {
    if (validStatuses.includes(overId)) return overId;
    const overTask = localTasks.find(t => t.id === overId);
    return overTask?.status ?? null;
  }

  function onDragStart({ active }: DragStartEvent) {
    const t = localTasks.find(t => t.id === active.id);
    setActiveTask(t ?? null);
    setOverColumnId(t?.status ?? null);
  }

  const onDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) { setOverColumnId(null); return; }

    const activeId = String(active.id);
    const overId   = String(over.id);
    if (activeId === overId) return;

    const targetColumn = resolveColumn(overId);
    if (!targetColumn) return;

    setOverColumnId(targetColumn);

    setLocalTasks(prev => {
      const activeIdx = prev.findIndex(t => t.id === activeId);
      if (activeIdx === -1) return prev;

      const activeItem = prev[activeIdx];
      const isCrossColumn = activeItem.status !== targetColumn;

      if (isCrossColumn) {
        const overIdx = prev.findIndex(t => t.id === overId);
        const insertAt = overIdx === -1 ? prev.length : overIdx;
        const updated = prev.map(t => t.id === activeId ? { ...t, status: targetColumn } : t);
        const withoutActive = updated.filter(t => t.id !== activeId);
        const newInsertAt = Math.min(insertAt, withoutActive.length);
        return [
          ...withoutActive.slice(0, newInsertAt),
          { ...activeItem, status: targetColumn },
          ...withoutActive.slice(newInsertAt),
        ];
      } else {
        const overIdx = prev.findIndex(t => t.id === overId);
        if (overIdx === -1) return prev;
        return arrayMove(prev, activeIdx, overIdx);
      }
    });
  }, [localTasks, validStatuses]);

  function onDragEnd({ active }: DragEndEvent) {
    const activeId = String(active.id);
    const movedTask = localTasks.find(t => t.id === activeId);
    const original  = tasks.find(t => t.id === activeId);

    if (movedTask && original && movedTask.status !== original.status) {
      updateTask.mutate({ id: activeId, payload: { status: movedTask.status } });
    }

    setActiveTask(null);
    setOverColumnId(null);
  }

  function onDragCancel() {
    setLocalTasks(tasks);
    setActiveTask(null);
    setOverColumnId(null);
  }

  const tasksByColumn = (key: string) => localTasks.filter(t => t.status === key);

  function openAdd(status: TaskStatus) {
    setAddStatus(status);
    setAddOpen(true);
  }

  function openNewColumn() {
    setEditingStatus(undefined);
    setColumnModalOpen(true);
  }

  function openEditColumn(s: BoardStatus) {
    setEditingStatus(s);
    setColumnModalOpen(true);
  }

  if (statusesLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 pt-1 select-none">
          {statuses.map(col => (
            <KanbanColumn
              key={col.id}
              status={col}
              tasks={tasksByColumn(col.key)}
              isOver={overColumnId === col.key && activeTask?.status !== col.key}
              onAdd={() => openAdd(col.key)}
              onEdit={() => openEditColumn(col)}
              onDelete={() => deleteStatus.mutate(col.id)}
              canDelete={statuses.length > 1}
            />
          ))}

          {/* Add column */}
          <button
            onClick={openNewColumn}
            className="group flex flex-col items-center justify-center gap-2 min-w-[180px] w-[180px] shrink-0 h-[calc(100dvh-300px)] min-h-[160px] rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground/50 hover:border-primary/50 hover:text-primary hover:bg-primary/[0.04] transition-colors"
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-muted/60 group-hover:bg-primary/10 transition-colors">
              <Plus className="size-4" />
            </div>
            <span className="text-xs font-medium">Add Column</span>
          </button>
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? <KanbanCard task={activeTask} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <AddTaskModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultStatus={addStatus}
      />

      <AnimatePresence>
        {columnModalOpen && (
          <StatusColumnModal
            status={editingStatus}
            onClose={() => setColumnModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
