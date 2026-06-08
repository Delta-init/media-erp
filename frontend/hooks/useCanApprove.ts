"use client";

import { useAuthStore } from "@/stores/authStore";
import { useTeams } from "@/hooks/useTeams";

/**
 * Returns a predicate `(task) => boolean` indicating whether the current user
 * may approve / rework a task in Pending Review.
 *
 * Allowed for: Super Admin, or a Team Leader of the task's team.
 * Personal tasks (no team) have no leader gate — the owner may approve.
 * Mirrors the backend workflow.can_approve rule.
 */
export function useCanApprove() {
  const user = useAuthStore((s) => s.user);
  const { data: teams = [] } = useTeams();

  const isSuperAdmin = !!(
    user?.role?.is_system_role && user?.role?.role_name === "Super Admin"
  );

  return (task: { team_id?: string | null }) => {
    if (isSuperAdmin) return true;
    if (!task.team_id) return true; // personal task — no leader gate
    const team = teams.find((t) => t.id === task.team_id);
    return team?.my_role === "leader" || team?.my_role === "admin";
  };
}
