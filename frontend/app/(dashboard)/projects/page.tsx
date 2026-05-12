"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Kanban, LayoutList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/projects/KanbanBoard";
import { TaskTable } from "@/components/projects/TaskTable";
import { AddTaskModal } from "@/components/projects/AddTaskModal";
import { ProjectFiltersBar } from "@/components/projects/ProjectFilters";
import { useTasks } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import type { ProjectFilters } from "@/types/project";

const EMPTY_FILTERS: ProjectFilters = {
  search: "",
  status: "",
  priority: "",
  date_filter: "",
  date_from: "",
  date_to: "",
};

type ViewMode = "kanban" | "table";

export default function ProjectsPage() {
  const [view, setView]         = useState<ViewMode>("kanban");
  const [addOpen, setAddOpen]   = useState(false);
  const [filters, setFilters]   = useState<ProjectFilters>(EMPTY_FILTERS);

  const { data: tasks = [], isLoading } = useTasks(filters);

  function patchFilter(patch: Partial<ProjectFilters>) {
    setFilters(prev => ({ ...prev, ...patch }));
  }

  const totalByStatus = {
    pending:           tasks.filter(t => t.status === "pending").length,
    upcoming:          tasks.filter(t => t.status === "upcoming").length,
    currently_working: tasks.filter(t => t.status === "currently_working").length,
    updation_needed:   tasks.filter(t => t.status === "updation_needed").length,
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} total
            {" · "}
            <span className="text-green-600 dark:text-green-400">{totalByStatus.currently_working} in progress</span>
            {" · "}
            <span className="text-yellow-600 dark:text-yellow-400">{totalByStatus.pending} pending</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5">
            {(["kanban", "table"] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  view === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "kanban" ? <Kanban className="size-3.5" /> : <LayoutList className="size-3.5" />}
                {v === "kanban" ? "Board" : "Table"}
              </button>
            ))}
          </div>

          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="size-3.5" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <ProjectFiltersBar
        filters={filters}
        onChange={patchFilter}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent"
          />
        </div>
      ) : view === "kanban" ? (
        <KanbanBoard tasks={tasks} />
      ) : (
        <TaskTable tasks={tasks} />
      )}

      {/* Global Add Modal */}
      <AddTaskModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}
