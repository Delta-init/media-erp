"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamMember {
  user_id: string;
  role: "leader" | "member";
  joined_at: string;
  name: string;
  email: string;
  designation: string;
  avatar?: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  color: string;
  status?: "active" | "inactive";
  created_by: string;
  members: TeamMember[];
  member_count: number;
  task_count?: number;
  done_count?: number;
  my_role?: "leader" | "member" | "admin";
  created_at: string;
  updated_at: string;
}

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  designation: string;
  avatar?: string;
  status: string;
}

export interface MemberReport {
  user: {
    id: string;
    name: string;
    email: string;
    designation: string;
    avatar?: string;
    status: string;
  };
  member_since: string | null;
  team_name: string;
  tasks: {
    total: number;
    completed: number;
    completion_pct: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    recent: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
      updated_at: string | null;
    }>;
  };
}

// ── Query keys ────────────────────────────────────────────────────────────────

const QK = {
  list: ["teams"] as const,
  detail: (id: string) => ["teams", id] as const,
  report: (teamId: string, userId: string) => ["teams", teamId, "members", userId, "report"] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useTeams() {
  return useQuery({
    queryKey: QK.list,
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Team[] }>("/teams");
      return data.data;
    },
  });
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: QK.detail(teamId),
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Team }>(`/teams/${teamId}`);
      return data.data;
    },
    enabled: !!teamId,
  });
}

export function useAssignableUsers() {
  return useQuery({
    queryKey: ["teams", "assignable-users"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: AssignableUser[] }>(
        "/teams/users"
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useMemberReport(teamId: string, userId: string) {
  return useQuery({
    queryKey: QK.report(teamId, userId),
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: MemberReport }>(
        `/teams/${teamId}/members/${userId}/report`
      );
      return data.data;
    },
    enabled: !!(teamId && userId),
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      color?: string;
      status?: "active" | "inactive";
      leader_ids?: string[];
      member_ids?: string[];
    }) => {
      const { data } = await api.post<{ success: boolean; data: Team }>("/teams", payload);
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.list });
      toast.success("Team created");
    },
    onError() {
      toast.error("Failed to create team");
    },
  });
}

export function useUpdateTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name?: string; description?: string; color?: string }) => {
      const { data } = await api.put<{ success: boolean; data: Team }>(`/teams/${teamId}`, payload);
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.list });
      qc.invalidateQueries({ queryKey: QK.detail(teamId) });
      toast.success("Team updated");
    },
    onError() {
      toast.error("Failed to update team");
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      await api.delete(`/teams/${teamId}`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.list });
      toast.success("Team deleted");
    },
    onError() {
      toast.error("Failed to delete team");
    },
  });
}

export function useAddTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { user_id: string; role: "member" | "leader" }) => {
      const { data } = await api.post(`/teams/${teamId}/members`, payload);
      return data;
    },
    // No per-item toast — callers may add several at once and show a summary.
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.detail(teamId) });
      qc.invalidateQueries({ queryKey: QK.list });
    },
  });
}

export function useRemoveTeamMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/teams/${teamId}/members/${userId}`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.detail(teamId) });
      toast.success("Member removed");
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Failed to remove member";
      toast.error(msg);
    },
  });
}

export function useUpdateMemberRole(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "member" | "leader" }) => {
      const { data } = await api.put(`/teams/${teamId}/members/${userId}/role`, { role });
      return data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.detail(teamId) });
      toast.success("Role updated");
    },
    onError() {
      toast.error("Failed to update role");
    },
  });
}
