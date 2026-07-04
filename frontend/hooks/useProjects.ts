"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type {
  CreateTaskPayload,
  ProjectFilters,
  Task,
  UpdateTaskPayload,
} from "@/types/project";

const QK = {
  tasks: (filters: Partial<ProjectFilters>) => ["projects", "tasks", filters] as const,
};

export interface LeaderTeam {
  id: string;
  name: string;
  color: string;
  members: { id: string; name: string; role: string }[];
}

export interface LeaderQueue {
  is_leader: boolean;
  review: Task[];
  incoming: Task[];
  reedit: Task[];
  teams: LeaderTeam[];
}

export function useTaskDetail(id: string | null) {
  return useQuery({
    queryKey: ["projects", "task", id],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Task }>(
        `/projects/${id}`
      );
      return data.data;
    },
    enabled: !!id,
    staleTime: 0,
  });
}

export function useLeaderQueue(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["projects", "leader-queue"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: LeaderQueue }>(
        "/projects/leader/queue"
      );
      return data.data;
    },
    refetchInterval: 15_000,
    enabled: opts?.enabled ?? true,
  });
}

export function useTasks(filters: Partial<ProjectFilters> = {}) {
  return useQuery({
    queryKey: QK.tasks(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters.search)      params.search      = filters.search;
      if (filters.status)      params.status      = filters.status;
      if (filters.priority)    params.priority    = filters.priority;
      if (filters.date_filter) params.date_filter = filters.date_filter;
      if (filters.date_from)   params.date_from   = filters.date_from;
      if (filters.date_to)     params.date_to     = filters.date_to;
      if (filters.team_id)     params.team_id     = filters.team_id;
      if (filters.member_id)   params.member_id   = filters.member_id;
      const { data } = await api.get<{ success: boolean; data: Task[] }>(
        "/projects",
        { params }
      );
      return data.data;
    },
    staleTime: 10_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTaskPayload) => {
      const { data } = await api.post<{ success: boolean; data: Task }>(
        "/projects",
        payload
      );
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Task created!");
    },
    onError() {
      toast.error("Failed to create task");
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateTaskPayload }) => {
      const { data } = await api.put<{ success: boolean; data: Task }>(
        `/projects/${id}`,
        payload
      );
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError(err: unknown) {
      // Revert the optimistic board move and surface the workflow reason
      qc.invalidateQueries({ queryKey: ["projects"] });
      const msg =
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.detail ||
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.message ||
        "Failed to update task";
      toast.error(msg);
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Task deleted");
    },
    onError() {
      toast.error("Failed to delete task");
    },
  });
}
