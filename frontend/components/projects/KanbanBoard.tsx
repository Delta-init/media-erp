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
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateTask } from "@/hooks/useProjects";
import { KanbanCard } from "./KanbanCard";
import { AddTaskModal } from "./AddTaskModal";
import type { Task, TaskStatus } from "@/types/project";
import { COLUMNS } from "@/types/project";
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
  colId: TaskStatus;
  label: string;
  color: string;
  bg: string;
  tasks: Task[];
  isOver: boolean;
  onAdd: () => void;
}

function KanbanColumn({ colId, label, color, bg, tasks, isOver, onAdd }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: colId });

  return (
    <div className="flex flex-col gap-2 min-w-[272px] w-[272px] shrink-0">
      {/* Header */}
      <div className={cn("rounded-xl border px-3 py-2.5 flex items-center justify-between transition-colors", bg)}>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-bold uppercase tracking-wider", color)}>{label}</span>
          <span className={cn(
            "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
            color, "bg-white/50 dark:bg-black/20"
          )}>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAdd}
          className={cn("rounded-lg p-1 transition-colors hover:bg-white/40 dark:hover:bg-black/20", color)}
          title={`Add to ${label}`}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 flex-1 min-h-[140px] rounded-xl p-1.5 transition-all duration-150",
          isOver
            ? "bg-primary/8 ring-2 ring-primary/25 ring-offset-1"
            : "bg-transparent"
        )}
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
            isOver ? "border-primary/40 bg-primary/5" : "border-muted-foreground/20"
          )}>
            <p className="text-xs text-muted-foreground/50 text-center">
              {isOver ? "Drop here" : "Drop tasks here\nor click + to add"}
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

  // Local copy for optimistic real-time ordering
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<TaskStatus | null>(null);
  const [addStatus, setAddStatus]     = useState<TaskStatus>("pending");
  const [addOpen, setAddOpen]         = useState(false);

  // Keep local state in sync when server data changes (but not while dragging)
  useEffect(() => {
    if (!activeTask) setLocalTasks(tasks);
  }, [tasks, activeTask]);

  // Sensors — separate mouse & touch so each gets proper activation constraints
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const validStatuses = COLUMNS.map(c => c.id) as string[];

  function resolveColumn(overId: string): TaskStatus | null {
    if (validStatuses.includes(overId)) return overId as TaskStatus;
    const overTask = localTasks.find(t => t.id === overId);
    return overTask?.status ?? null;
  }

  // ── DragStart ───────────────────────────────────────────────────────────────
  function onDragStart({ active }: DragStartEvent) {
    const t = localTasks.find(t => t.id === active.id);
    setActiveTask(t ?? null);
    setOverColumnId(t?.status ?? null);
  }

  // ── DragOver — real-time optimistic column switch + intra-column reorder ────
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
        // Move to new column, insert before the over-item (or at end of column)
        const overIdx = prev.findIndex(t => t.id === overId);
        const insertAt = overIdx === -1 ? prev.length : overIdx;

        const updated = prev
          .map(t => t.id === activeId ? { ...t, status: targetColumn } : t);

        // Re-order: move activeIdx to insertAt
        const withoutActive = updated.filter(t => t.id !== activeId);
        const newInsertAt = Math.min(insertAt, withoutActive.length);
        return [
          ...withoutActive.slice(0, newInsertAt),
          { ...activeItem, status: targetColumn },
          ...withoutActive.slice(newInsertAt),
        ];
      } else {
        // Same column — reorder
        const overIdx = prev.findIndex(t => t.id === overId);
        if (overIdx === -1) return prev;
        return arrayMove(prev, activeIdx, overIdx);
      }
    });
  }, [localTasks]);

  // ── DragEnd — commit the change that already happened optimistically ─────────
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

  // ── DragCancel — revert to server state ────────────────────────────────────
  function onDragCancel() {
    setLocalTasks(tasks);
    setActiveTask(null);
    setOverColumnId(null);
  }

  const tasksByColumn = (id: TaskStatus) => localTasks.filter(t => t.status === id);

  function openAdd(status: TaskStatus) {
    setAddStatus(status);
    setAddOpen(true);
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
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 select-none">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              colId={col.id}
              label={col.label}
              color={col.color}
              bg={col.bg}
              tasks={tasksByColumn(col.id)}
              isOver={overColumnId === col.id && activeTask?.status !== col.id}
              onAdd={() => openAdd(col.id)}
            />
          ))}
        </div>

        {/* Overlay — the card that follows the cursor */}
        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? <KanbanCard task={activeTask} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <AddTaskModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultStatus={addStatus}
      />
    </>
  );
}
