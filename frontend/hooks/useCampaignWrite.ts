"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post(`/campaigns/${campaignId}/pause`);
      return data;
    },
    onSuccess() {
      toast.success("Campaign paused");
      qc.invalidateQueries({ queryKey: ["reports", "campaigns"] });
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to pause campaign");
    },
  });
}

export function useResumeCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data } = await api.post(`/campaigns/${campaignId}/resume`);
      return data;
    },
    onSuccess() {
      toast.success("Campaign resumed");
      qc.invalidateQueries({ queryKey: ["reports", "campaigns"] });
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to resume campaign");
    },
  });
}

export function useUpdateCampaignBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campaignId,
      connectorId,
      dailyBudget,
    }: {
      campaignId: string;
      connectorId: string;
      dailyBudget: number;
    }) => {
      const { data } = await api.patch(`/campaigns/${campaignId}/budget`, {
        connector_id: connectorId,
        daily_budget: dailyBudget,
      });
      return data;
    },
    onSuccess() {
      toast.success("Budget updated");
      qc.invalidateQueries({ queryKey: ["reports", "campaigns"] });
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to update budget");
    },
  });
}

export function useWriteConnectors() {
  return useQuery({
    queryKey: ["campaigns", "write-connectors"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: WriteConnector[] }>(
        "/campaigns/write/connectors"
      );
      return data.data;
    },
  });
}

export interface WriteConnector {
  id: string;
  name: string;
  platform: string;
  platform_account_id?: string;
}
