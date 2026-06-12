"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export interface MediaTask {
  id: string;
  title: string;
  description?: string | null;
  team_id: string;
  assigned_to: string;
  start_date: string;
  due_date: string;
  priority: "low" | "medium" | "high";
  status: "scheduled" | "active" | "completed" | "cancelled";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type MediaTaskParams = {
  team_id?: string;
  assigned_to?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
};

const QK = {
  list: (p: MediaTaskParams) => ["media-schedule", "tasks", p],
};

export function useMediaTasks(params?: MediaTaskParams) {
  return useQuery({
    queryKey: QK.list(params ?? {}),
    queryFn: async () => {
      const cleanParams: Record<string, string> = {};
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (v) cleanParams[k] = v;
        }
      }
      const { data } = await api.get("/media-schedule/tasks", { params: cleanParams });
      return (data.data?.tasks ?? []) as MediaTask[];
    },
    refetchInterval: 60_000,
  });
}

export function useCreateMediaTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title: string;
      description?: string;
      team_id: string;
      assigned_to: string;
      start_date: string;
      due_date: string;
      priority?: string;
    }) => {
      const { data } = await api.post("/media-schedule/tasks", body);
      return data;
    },
    onSuccess: () => {
      toast.success("Task scheduled");
      qc.invalidateQueries({ queryKey: ["media-schedule"] });
    },
    onError: (e: any) => {
      toast.error(
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to create task"
      );
    },
  });
}

export function useUpdateMediaTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; [key: string]: any }) => {
      const { data } = await api.patch(`/media-schedule/tasks/${id}`, body);
      return data;
    },
    onSuccess: () => {
      toast.success("Task updated");
      qc.invalidateQueries({ queryKey: ["media-schedule"] });
    },
    onError: (e: any) => {
      toast.error(
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to update task"
      );
    },
  });
}

export function useCancelMediaTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/media-schedule/tasks/${id}`);
      return data;
    },
    onSuccess: () => {
      toast.success("Task cancelled");
      qc.invalidateQueries({ queryKey: ["media-schedule"] });
    },
    onError: (e: any) => {
      toast.error(
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to cancel task"
      );
    },
  });
}
