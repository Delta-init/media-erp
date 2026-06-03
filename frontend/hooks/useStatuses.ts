"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type { BoardStatus } from "@/types/project";

const QK = ["board-statuses"] as const;

export function useStatuses() {
  return useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: BoardStatus[] }>(
        "/board-statuses"
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { label: string; color: string }) => {
      const { data } = await api.post<{ success: boolean; data: BoardStatus }>(
        "/board-statuses",
        payload
      );
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Column added");
    },
    onError() {
      toast.error("Failed to add column");
    },
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { label?: string; color?: string; position?: number };
    }) => {
      const { data } = await api.put<{ success: boolean; data: BoardStatus }>(
        `/board-statuses/${id}`,
        payload
      );
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Column updated");
    },
    onError() {
      toast.error("Failed to update column");
    },
  });
}

export function useDeleteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/board-statuses/${id}`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["projects"] }); // tasks were reassigned
      toast.success("Column deleted");
    },
    onError(err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.detail ||
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.message ||
        "Failed to delete column";
      toast.error(msg);
    },
  });
}
