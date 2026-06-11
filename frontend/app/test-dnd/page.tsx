"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
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
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  CSS,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";

const COLUMNS = [
  { key: "pending",        label: "Pending",        color: "#f59e0b" },
  { key: "started",        label: "Started",        color: "#3b82f6" },
  { key: "break",          label: "Break",          color: "#f97316" },
  { key: "reedit",         label: "Reedit",         color: "#f43f5e" },
  { key: "pending_review", label: "Pending Review", color: "#a855f7" },
  { key: "approved",       label: "Approved",       color: "#22c55e" },
];

const ALLOWED: Record<string, string[]> = {
  pending:        ["started"],
  started:        ["break", "pending_review"],
  break:          ["started"],
  reedit:         ["started"],
  pending_review: ["approved", "reedit"],
  approved:       [],
};

function canMove(from: string, to: string) {
  return from === to || (ALLOWED[from] ?? []).includes(to);
}

type Task = { id: string; title: string; status: string };

const INITIAL_TASKS: Task[] = [
  { id: "t1", title: "Design homepage banner",     status: "pending" },
  { id: "t2", title: "Write product copy",          status: "pending" },
  { id: "t3", title: "Shoot product video",         status: "started" },
  { id: "t4", title: "Edit reel footage",           status: "started" },
  { id: "t5", title: "Schedule Instagram posts",    status: "break" },
  { id: "t6", title: "Review Facebook ad copy",     status: "pending_review" },
  { id: "t7", title: "Approve campaign budget",     status: "approved" },
];

const COL_KEYS = COLUMNS.map(c => c.key);

function toCol(id: string, tasks: Task[]): string | null {
  if (COL_KEYS.includes(id)) return id;
  return tasks.find(t => t.id === id)?.status ?? null;
}

const dropAnimation: DropAnimation = {
  duration: 200,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};

function Card({ task, overlay }: { task: Task; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition ?? "transform 200ms ease",
    touchAction: "none" as const,
  };
  const col = COLUMNS.find(c => c.key === task.status);

  if (isDragging && !overlay) {
    return (
      <div ref={setNodeRef} style={style}
        className="h-16 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50" />
    );
  }

  return (
    <div ref={setNodeRef} style={{ ...style, borderLeft: `3px solid ${col?.color ?? "#ccc"}` }}
      {...attributes} {...listeners}
      className={`rounded-lg border bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing select-none
        ${overlay ? "shadow-xl rotate-1 scale-105" : "hover:shadow-md"}`}>
      <p className="text-sm font-medium text-gray-800">{task.title}</p>
      <p className="text-xs text-gray-400 mt-1 capitalize">{task.status.replace(/_/g, " ")}</p>
    </div>
  );
}

function Column({ col, tasks, isOver }: { col: typeof COLUMNS[0]; tasks: Task[]; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: col.key });
  return (
    <div className="flex flex-col w-48 shrink-0">
      <div className="rounded-t-lg px-3 py-2 text-xs font-bold uppercase tracking-wide"
        style={{ backgroundColor: col.color + "22", color: col.color, borderTop: `2px solid ${col.color}` }}>
        {col.label} <span className="ml-1 opacity-60">({tasks.length})</span>
      </div>
      <div ref={setNodeRef} className="flex flex-col gap-2 rounded-b-lg border p-2 flex-1 min-h-[200px] transition-colors"
        style={{ backgroundColor: isOver ? col.color + "1c" : col.color + "07", borderColor: col.color + "33" }}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {tasks.map(task => (
              <motion.div key={task.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}>
                <Card task={task} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded border border-dashed border-gray-200 py-8">
            <p className="text-xs text-gray-300">{isOver ? "Drop here" : "Empty"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TestDndPage() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [active, setActive] = useState<Task | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>(["Ready — drag a card to test"]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function addLog(msg: string) {
    setLog(prev => [msg, ...prev].slice(0, 8));
  }

  function onDragStart({ active }: DragStartEvent) {
    const task = tasks.find(t => t.id === active.id);
    setActive(task ?? null);
    setOverCol(task?.status ?? null);
    addLog(`▶ Drag started: "${task?.title}" from ${task?.status}`);
  }

  function onDragOver({ over }: DragOverEvent) {
    if (!over) { setOverCol(null); return; }
    const col = toCol(String(over.id), tasks);
    if (col) setOverCol(col);
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    setActive(null);
    setOverCol(null);

    if (!over) { addLog("✗ Dropped outside any column"); return; }

    const activeId = String(a.id);
    const overId   = String(over.id);
    if (activeId === overId) { addLog("↩ Same position, no change"); return; }

    const task = tasks.find(t => t.id === activeId);
    if (!task) return;

    const target = toCol(overId, tasks);
    if (!target) { addLog("✗ Could not determine target column"); return; }

    if (target === task.status) {
      setTasks(prev => {
        const from = prev.findIndex(t => t.id === activeId);
        const to   = prev.findIndex(t => t.id === overId);
        if (from === -1 || to === -1 || from === to) return prev;
        return arrayMove(prev, from, to);
      });
      addLog(`↕ Reordered within ${target}`);
      return;
    }

    if (!canMove(task.status, target)) {
      addLog(`✗ BLOCKED: ${task.status} → ${target} not allowed`);
      return;
    }

    setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: target } : t));
    addLog(`✓ Moved "${task.title}": ${task.status} → ${target}`);
  }

  function onDragCancel() {
    setActive(null);
    setOverCol(null);
    addLog("✗ Drag cancelled");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-xl font-bold mb-1">Drag & Drop Test</h1>
      <p className="text-sm text-gray-500 mb-4">
        Drag cards between columns. Allowed: Pending→Started, Started→Break/Review, Break→Started, Reedit→Started
      </p>

      {/* Log */}
      <div className="mb-4 rounded-lg border bg-white p-3 text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
        {log.map((l, i) => <div key={i} className={i === 0 ? "text-blue-600 font-bold" : "text-gray-400"}>{l}</div>)}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className="flex gap-3 overflow-x-auto pb-4 select-none">
          {COLUMNS.map(col => (
            <Column key={col.key} col={col}
              tasks={tasks.filter(t => t.status === col.key)}
              isOver={overCol === col.key && active?.status !== col.key} />
          ))}
        </div>
        <DragOverlay dropAnimation={dropAnimation}>
          {active ? <Card task={active} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
