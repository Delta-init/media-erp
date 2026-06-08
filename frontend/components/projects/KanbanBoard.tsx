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
  useDroppable,
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
import { toast } from "sonner";
import { useCanApprove } from "@/hooks/useCanApprove";
import type { Task, TaskStatus, BoardColumn } from "@/types/project";
import { BOARD_COLUMNS, statusStyles, canTransition } from "@/types/project";

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
  column: BoardColumn;
  tasks: Task[];
  isOver: boolean;
  onAdd: () => void;
}

function KanbanColumn({ column, tasks, isOver, onAdd }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.key });
  const s = statusStyles(column.color);

  return (
    <div className="flex flex-col flex-1 min-w-[220px]">
      {/* Header — solid top accent in the column colour */}
      <div
        className="rounded-t-xl border border-b-0 px-3 py-2.5 flex items-center justify-between"
        style={{ ...s.headerBg, borderTop: `2px solid ${column.color}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2.5 rounded-full shrink-0" style={s.dot} />
          <span className="text-[11px] font-bold uppercase tracking-wider truncate" style={s.text}>
            {column.label}
          </span>
          <span
            className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold shrink-0"
            style={s.badgeBg}
          >
            {tasks.length}
          </span>
        </div>

        {/* New work only enters at Pending — only that column gets a + */}
        {column.key === "pending" && (
          <button
            onClick={onAdd}
            className="rounded-md p-1 opacity-80 hover:opacity-100 hover:bg-white/40 dark:hover:bg-black/25 transition-all"
            style={s.text}
            title="Add task to Pending"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      {/* Drop zone — fixed height, scrolls internally with the scrollbar hidden */}
      <div
        ref={setNodeRef}
        className={cn(
          "no-scrollbar flex flex-col gap-2 rounded-b-xl border border-t-0 p-1.5 transition-colors duration-150",
          "h-[calc(100dvh-290px)] min-h-[160px] overflow-y-auto overflow-x-hidden",
          isOver ? "ring-2 ring-inset" : ""
        )}
        style={{
          backgroundColor: isOver ? `${column.color}14` : `${column.color}07`,
          borderColor: `${column.color}33`,
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
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
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-lg border border-dashed p-6 transition-colors duration-150",
              isOver ? "border-primary/40 bg-primary/5" : "border-muted-foreground/15"
            )}
          >
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
  const canApprove = useCanApprove();

  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<TaskStatus | null>(null);
  const [addStatus, setAddStatus]     = useState<TaskStatus>(BOARD_COLUMNS[0].key);
  const [addOpen, setAddOpen]         = useState(false);

  useEffect(() => {
    if (!activeTask) setLocalTasks(tasks);
  }, [tasks, activeTask]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const validStatuses = BOARD_COLUMNS.map((c) => c.key);

  function resolveColumn(overId: string): TaskStatus | null {
    if (validStatuses.includes(overId)) return overId;
    const overTask = localTasks.find((t) => t.id === overId);
    return overTask?.status ?? null;
  }

  function onDragStart({ active }: DragStartEvent) {
    const t = localTasks.find((t) => t.id === active.id);
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

    // Block invalid workflow moves while dragging — keep the card in place.
    const dragged = localTasks.find((t) => t.id === activeId);
    if (dragged && dragged.status !== targetColumn) {
      if (!canTransition(dragged.status, targetColumn)) return;
      // Pending Review can only be moved by a team leader / admin
      if (dragged.status === "pending_review" && !canApprove(dragged)) return;
    }
    setOverColumnId(targetColumn);

    setLocalTasks((prev) => {
      const activeIdx = prev.findIndex((t) => t.id === activeId);
      if (activeIdx === -1) return prev;
      const activeItem = prev[activeIdx];
      const isCrossColumn = activeItem.status !== targetColumn;

      if (isCrossColumn) {
        const overIdx = prev.findIndex((t) => t.id === overId);
        const insertAt = overIdx === -1 ? prev.length : overIdx;
        const updated = prev.map((t) => (t.id === activeId ? { ...t, status: targetColumn } : t));
        const withoutActive = updated.filter((t) => t.id !== activeId);
        const newInsertAt = Math.min(insertAt, withoutActive.length);
        return [
          ...withoutActive.slice(0, newInsertAt),
          { ...activeItem, status: targetColumn },
          ...withoutActive.slice(newInsertAt),
        ];
      } else {
        const overIdx = prev.findIndex((t) => t.id === overId);
        if (overIdx === -1) return prev;
        return arrayMove(prev, activeIdx, overIdx);
      }
    });
  }, [localTasks, validStatuses]);

  function onDragEnd({ active }: DragEndEvent) {
    const activeId = String(active.id);
    const movedTask = localTasks.find((t) => t.id === activeId);
    const original  = tasks.find((t) => t.id === activeId);
    if (movedTask && original && movedTask.status !== original.status) {
      // Safety net — should already be prevented in onDragOver
      if (!canTransition(original.status, movedTask.status)) {
        setLocalTasks(tasks);
        toast.error("That move isn't allowed by the workflow.");
      } else {
        updateTask.mutate({ id: activeId, payload: { status: movedTask.status } });
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

  const tasksByColumn = (key: string) => localTasks.filter((t) => t.status === key);

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
        {/* Equal-width columns fill the board — no horizontal scroll on desktop */}
        <div className="flex gap-3 pb-2 pt-1 select-none min-w-0">
          {BOARD_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              column={col}
              tasks={tasksByColumn(col.key)}
              isOver={overColumnId === col.key && activeTask?.status !== col.key}
              onAdd={() => openAdd(col.key)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? <KanbanCard task={activeTask} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} defaultStatus={addStatus} />
    </>
  );
}
