"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export interface BudgetGoal {
  id: string;
  campaign_id: string;
  campaign_name: string;
  platform: string;
  connector_id: string;
  total_budget: number;
  alert_threshold_pct: number;
  period: string;
  period_start?: string;
  period_end?: string;
  created_at: string;
}

export interface BudgetAlert {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  total_budget: number;
  actual_spend: number;
  spend_pct: number;
  alert_threshold_pct: number;
}

export interface BudgetPacing {
  campaign_id: string;
  campaign_name: string;
  platform: string;
  total_budget: number;
  actual_spend: number;
  expected_spend: number;
  pacing_ratio: number;
  status: "on_track" | "overpacing" | "underpacing" | "exceeded";
}

export function useBudgetGoals() {
  return useQuery({
    queryKey: ["budget", "goals"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: BudgetGoal[] }>("/budget/goals");
      return data.data;
    },
  });
}

export function useCreateBudgetGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      campaign_id: string;
      campaign_name: string;
      platform: string;
      connector_id: string;
      total_budget: number;
      alert_threshold_pct?: number;
      period?: string;
    }) => {
      const { data } = await api.post("/budget/goals", body);
      return data;
    },
    onSuccess() {
      toast.success("Budget goal created");
      qc.invalidateQueries({ queryKey: ["budget"] });
    },
    onError() {
      toast.error("Failed to create budget goal");
    },
  });
}

export function useDeleteBudgetGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/budget/goals/${id}`);
    },
    onSuccess() {
      toast.success("Budget goal removed");
      qc.invalidateQueries({ queryKey: ["budget"] });
    },
    onError() {
      toast.error("Failed to remove budget goal");
    },
  });
}

export function useBudgetAlerts() {
  return useQuery({
    queryKey: ["budget", "alerts"],
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: BudgetAlert[];
      }>("/budget/alerts");
      return data.data ?? [];
    },
    refetchInterval: 60_000,
  });
}

export function useBudgetPacing() {
  return useQuery({
    queryKey: ["budget", "pacing"],
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: BudgetPacing[];
      }>("/budget/pacing");
      return data.data ?? [];
    },
    staleTime: 300_000,
  });
}
