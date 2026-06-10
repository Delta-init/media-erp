"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  useDroppable,
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateTask } from "@/hooks/useProjects";
import { KanbanCard } from "./KanbanCard";
import { AddTaskModal } from "./AddTaskModal";
import { toast } from "sonner";
import { useCanApprove } from "@/hooks/useCanApprove";
import type { Task, TaskStatus, BoardColumn } from "@/types/project";
import { BOARD_COLUMNS, statusStyles, canTransition } from "@/types/project";

// ── Drop animation ─────────────────────────────────────────────────────────────
const dropAnimation: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
  }),
};

// ── Column ─────────────────────────────────────────────────────────────────────
interface ColumnProps {
  column: BoardColumn;
  tasks: Task[];
  isOver: boolean;
  onAdd: () => void;
}

function KanbanColumn({ column, tasks, isOver, onAdd }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.key });
  const s = statusStyles(column.color);

  return (
    <div className="flex flex-col flex-1 min-w-[200px] h-full min-h-0">
      {/* Header */}
      <div
        className="rounded-t-xl border border-b-0 px-3 py-2.5 flex items-center justify-between"
        style={{ ...s.headerBg, borderTop: `2px solid ${column.color}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2 rounded-full shrink-0" style={s.dot} />
          <span
            className="text-[11px] font-bold uppercase tracking-wider truncate"
            style={s.text}
          >
            {column.label}
          </span>
          <span
            className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold shrink-0"
            style={s.badgeBg}
          >
            {tasks.length}
          </span>
        </div>

        {column.key === "pending" && (
          <button
            onClick={onAdd}
            className="rounded-md p-1 opacity-70 hover:opacity-100 hover:bg-white/30 dark:hover:bg-black/20 transition-all"
            style={s.text}
            title="Add task"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "no-scrollbar flex flex-col gap-2 rounded-b-xl border border-t-0 p-1.5",
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
          "transition-colors duration-150",
          isOver && "ring-2 ring-inset"
        )}
        style={{
          backgroundColor: isOver
            ? `${column.color}18`
            : `${column.color}07`,
          borderColor: `${column.color}33`,
          ringColor: column.color,
        }}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* No framer-motion layout/layoutId on sortable items —
              those conflict with dnd-kit's CSS transforms and cause jitter.
              Only use initial/animate/exit for mount/unmount transitions. */}
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              >
                <KanbanCard task={task} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>

        {tasks.length === 0 && (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-lg border border-dashed p-6",
              "transition-colors duration-150",
              isOver
                ? "border-primary/40 bg-primary/5"
                : "border-muted-foreground/12"
            )}
          >
            <p className="text-[11px] text-muted-foreground/40 text-center whitespace-pre-line">
              {isOver ? "Drop here" : "No tasks\nclick + to add"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────────
interface Props {
  tasks: Task[];
}

export function KanbanBoard({ tasks }: Props) {
  const updateTask = useUpdateTask();
  const canApprove = useCanApprove();

  const [localTasks,   setLocalTasks]   = useState<Task[]>(tasks);
  const [activeTask,   setActiveTask]   = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<TaskStatus | null>(null);
  const [addStatus,    setAddStatus]    = useState<TaskStatus>(BOARD_COLUMNS[0].key);
  const [addOpen,      setAddOpen]      = useState(false);

  // Sync server state only when not dragging
  useEffect(() => {
    if (!activeTask) setLocalTasks(tasks);
  }, [tasks, activeTask]);

  // PointerSensor handles mouse + touch with a single sensor (no double-firing)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const validStatuses = BOARD_COLUMNS.map((c) => c.key);

  function resolveColumn(overId: string): TaskStatus | null {
    if (validStatuses.includes(overId)) return overId;
    return localTasks.find((t) => t.id === overId)?.status ?? null;
  }

  function onDragStart({ active }: DragStartEvent) {
    const t = localTasks.find((t) => t.id === active.id);
    setActiveTask(t ?? null);
    setOverColumnId(t?.status ?? null);
  }

  const onDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over) { setOverColumnId(null); return; }

      const activeId = String(active.id);
      const overId   = String(over.id);
      if (activeId === overId) return;

      const targetColumn = resolveColumn(overId);
      if (!targetColumn) return;

      const dragged = localTasks.find((t) => t.id === activeId);
      if (dragged && dragged.status !== targetColumn) {
        // Block invalid workflow transitions
        if (!canTransition(dragged.status, targetColumn)) return;
        // Pending Review locked for non-leaders
        if (dragged.status === "pending_review" && !canApprove(dragged)) return;
      }

      setOverColumnId(targetColumn);

      setLocalTasks((prev) => {
        const activeIdx = prev.findIndex((t) => t.id === activeId);
        if (activeIdx === -1) return prev;

        const activeItem = prev[activeIdx];
        const isCrossColumn = activeItem.status !== targetColumn;

        if (isCrossColumn) {
          const overIdx    = prev.findIndex((t) => t.id === overId);
          const updated    = prev.map((t) =>
            t.id === activeId ? { ...t, status: targetColumn } : t
          );
          const withoutActive = updated.filter((t) => t.id !== activeId);
          const insertAt = overIdx === -1 ? withoutActive.length : Math.min(overIdx, withoutActive.length);
          return [
            ...withoutActive.slice(0, insertAt),
            { ...activeItem, status: targetColumn },
            ...withoutActive.slice(insertAt),
          ];
        } else {
          const overIdx = prev.findIndex((t) => t.id === overId);
          if (overIdx === -1) return prev;
          return arrayMove(prev, activeIdx, overIdx);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localTasks]
  );

  function onDragEnd({ active }: DragEndEvent) {
    const activeId   = String(active.id);
    const movedTask  = localTasks.find((t) => t.id === activeId);
    const original   = tasks.find((t) => t.id === activeId);

    if (movedTask && original && movedTask.status !== original.status) {
      if (!canTransition(original.status, movedTask.status)) {
        setLocalTasks(tasks);
        toast.error("That move isn't allowed by the workflow.");
      } else {
        updateTask.mutate({
          id: activeId,
          payload: { status: movedTask.status },
        });
      }
    }

    setActiveTask(null);
    setOverColumnId(null);
  }

  function onDragCancel() {
    setLocalTasks(tasks);
    setActiveTask(null);
    setOverColumnId(null);
  }

  const tasksByColumn = (key: string) =>
    localTasks.filter((t) => t.status === key);

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
        <div className="no-scrollbar flex h-full min-h-0 gap-3 pt-1 pb-1 select-none overflow-x-auto">
          {BOARD_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              column={col}
              tasks={tasksByColumn(col.key)}
              isOver={
                overColumnId === col.key &&
                activeTask?.status !== col.key
              }
              onAdd={() => openAdd(col.key)}
            />
          ))}
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
    </>
  );
}
