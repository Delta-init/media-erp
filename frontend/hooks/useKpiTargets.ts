"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export interface KpiTarget {
  id: string;
  metric: string;
  target_value: number;
  period: "daily" | "weekly" | "monthly";
  platform?: string;
  label?: string;
  created_at: string;
  updated_at: string;
}

export function useKpiTargets() {
  return useQuery({
    queryKey: ["kpi-targets"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: KpiTarget[] }>("/kpi-targets");
      return data.data;
    },
  });
}

export function useCreateKpiTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Omit<KpiTarget, "id" | "created_at" | "updated_at">) => {
      const { data } = await api.post("/kpi-targets", body);
      return data;
    },
    onSuccess() {
      toast.success("Target created");
      qc.invalidateQueries({ queryKey: ["kpi-targets"] });
    },
    onError() {
      toast.error("Failed to create target");
    },
  });
}

export function useUpdateKpiTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: Partial<Omit<KpiTarget, "id" | "created_at" | "updated_at">> & { id: string }) => {
      const { data } = await api.put(`/kpi-targets/${id}`, body);
      return data;
    },
    onSuccess() {
      toast.success("Target updated");
      qc.invalidateQueries({ queryKey: ["kpi-targets"] });
    },
    onError() {
      toast.error("Failed to update target");
    },
  });
}

export function useDeleteKpiTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/kpi-targets/${id}`);
    },
    onSuccess() {
      toast.success("Target removed");
      qc.invalidateQueries({ queryKey: ["kpi-targets"] });
    },
    onError() {
      toast.error("Failed to remove target");
    },
  });
}
