"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type { Pipeline } from "@/types/pipeline";

const QK = {
  list: ["pipelines"] as const,
  detail: (id: string) => ["pipelines", id] as const,
};

export function usePipelines() {
  return useQuery({
    queryKey: QK.list,
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Pipeline[] }>("/pipelines");
      return data.data;
    },
  });
}

export function usePipeline(id: string) {
  return useQuery({
    queryKey: QK.detail(id),
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Pipeline }>(`/pipelines/${id}`);
      return data.data;
    },
    enabled: !!id && id !== "new",
  });
}

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; nodes: unknown[]; edges: unknown[] }) => {
      const { data } = await api.post<{ success: boolean; data: Pipeline }>("/pipelines", payload);
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.list });
      toast.success("Pipeline created");
    },
    onError() {
      toast.error("Failed to create pipeline");
    },
  });
}

export function useUpdatePipeline(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name?: string; nodes?: unknown[]; edges?: unknown[] }) => {
      const { data } = await api.put<{ success: boolean; data: Pipeline }>(`/pipelines/${id}`, payload);
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.list });
      qc.invalidateQueries({ queryKey: QK.detail(id) });
      toast.success("Pipeline saved");
    },
    onError() {
      toast.error("Failed to save pipeline");
    },
  });
}

export function useDeletePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pipelines/${id}`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.list });
      toast.success("Pipeline deleted");
    },
    onError() {
      toast.error("Failed to delete pipeline");
    },
  });
}
