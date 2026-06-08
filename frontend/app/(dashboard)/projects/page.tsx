"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Kanban, LayoutList, Plus, Users, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/projects/KanbanBoard";
import { TaskTable } from "@/components/projects/TaskTable";
import { AddTaskModal } from "@/components/projects/AddTaskModal";
import { ProjectFiltersBar } from "@/components/projects/ProjectFilters";
import { useTasks } from "@/hooks/useProjects";
import { useTeams, useTeam } from "@/hooks/useTeams";
import { cn } from "@/lib/utils";
import type { ProjectFilters } from "@/types/project";

const EMPTY_FILTERS: ProjectFilters = {
  search: "",
  status: "",
  priority: "",
  date_filter: "",
  date_from: "",
  date_to: "",
  team_id: "",
  member_id: "",
};

type ViewMode = "kanban" | "table";

export default function ProjectsPage() {
  const [view, setView]         = useState<ViewMode>("kanban");
  const [addOpen, setAddOpen]   = useState(false);
  // Initialise team_id from the ?team_id= URL param (client-only initializer
  // avoids the useSearchParams Suspense requirement).
  const [filters, setFilters]   = useState<ProjectFilters>(() => {
    if (typeof window !== "undefined") {
      const tid = new URLSearchParams(window.location.search).get("team_id");
      if (tid) return { ...EMPTY_FILTERS, team_id: tid };
    }
    return EMPTY_FILTERS;
  });

  // Teams the current user belongs to
  const { data: teams = [] } = useTeams();
  // Enriched detail (members + my_role) for the selected team
  const { data: teamDetail } = useTeam(filters.team_id || "");

  const { data: tasks = [], isLoading } = useTasks(filters);

  function patchFilter(patch: Partial<ProjectFilters>) {
    setFilters(prev => ({ ...prev, ...patch }));
  }

  // Only leaders / admins can browse other members' tasks
  const canFilterByMember =
    teamDetail?.my_role === "leader" || teamDetail?.my_role === "admin";

  const memberOptions = useMemo(
    () => (teamDetail?.members ?? []).map(m => ({ id: m.user_id, name: m.name || m.email })),
    [teamDetail]
  );

  const totalByStatus = {
    pending:  tasks.filter(t => t.status === "pending").length,
    started:  tasks.filter(t => t.status === "started").length,
    approved: tasks.filter(t => t.status === "approved").length,
  };

  return (
    <div className="flex flex-col gap-5 h-full min-h-0">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} total
            {" · "}
            <span className="text-blue-600 dark:text-blue-400">{totalByStatus.started} started</span>
            {" · "}
            <span className="text-green-600 dark:text-green-400">{totalByStatus.approved} approved</span>
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

      {/* Team + member scope selectors */}
      {teams.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <select
              value={filters.team_id || ""}
              onChange={e => patchFilter({ team_id: e.target.value, member_id: "" })}
              className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition min-w-[160px]"
            >
              <option value="">All my tasks</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Member selector — only for leaders / admins of the selected team */}
          {filters.team_id && canFilterByMember && (
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              <select
                value={filters.member_id || ""}
                onChange={e => patchFilter({ member_id: e.target.value })}
                className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition min-w-[160px]"
              >
                <option value="">All members</option>
                {memberOptions.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {filters.team_id && (
            <span className="text-xs text-muted-foreground ml-auto">
              {teamDetail?.my_role === "leader"
                ? "Viewing team tasks (you're a leader)"
                : teamDetail?.my_role === "admin"
                ? "Viewing team tasks (admin)"
                : "Viewing your tasks in this team"}
            </span>
          )}
        </div>
      )}

      {/* Filters bar */}
      <ProjectFiltersBar
        filters={filters}
        onChange={patchFilter}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      {/* Content — fills remaining height; scrolls internally (no page scroll) */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent"
            />
          </div>
        ) : view === "kanban" ? (
          <KanbanBoard tasks={tasks} />
        ) : (
          <div className="h-full overflow-auto no-scrollbar">
            <TaskTable tasks={tasks} />
          </div>
        )}
      </div>

      {/* Global Add Modal */}
      <AddTaskModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultTeamId={filters.team_id || ""}
      />
    </div>
  );
}
