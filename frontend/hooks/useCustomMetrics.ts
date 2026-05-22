"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export interface CustomMetric {
  _id:        string;
  name:       string;
  label:      string;
  formula:    string;
  created_at: string;
}

export interface CreateMetricPayload {
  name:    string;
  label:   string;
  formula: string;
}

export interface PreviewResult {
  valid:          boolean;
  error:          string | null;
  result:         number | null;
  sample_inputs:  Record<string, number>;
}

const QK = {
  list: () => ["custom-metrics"] as const,
};

export function useCustomMetrics() {
  return useQuery({
    queryKey: QK.list(),
    queryFn:  async () => {
      const { data } = await api.get<{ success: boolean; data: CustomMetric[] }>(
        "/custom-metrics"
      );
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateCustomMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateMetricPayload) => {
      const { data } = await api.post<{ success: boolean; data: CustomMetric }>(
        "/custom-metrics",
        body,
      );
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.list() });
      toast.success("Custom metric saved");
    },
    onError(err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to save metric");
    },
  });
}

export function useDeleteCustomMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/custom-metrics/${id}`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.list() });
      toast.success("Metric deleted");
    },
    onError() {
      toast.error("Failed to delete metric");
    },
  });
}

export function usePreviewFormula() {
  return useMutation({
    mutationFn: async (body: { formula: string; sample_values?: Record<string, number> }) => {
      const { data } = await api.post<{ success: boolean; data: PreviewResult }>(
        "/custom-metrics/preview",
        body,
      );
      return data.data;
    },
  });
}
