"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type {
  Connector,
  CreateConnectorPayload,
  UpdateConnectorPayload,
} from "@/types/connector";

const QK = ["connectors"] as const;

export function useConnectors() {
  return useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Connector[] }>(
        "/connectors"
      );
      return data.data;
    },
    // Auto-poll every 4 s while at least one connector is syncing;
    // stops automatically once all connectors reach a terminal status.
    refetchInterval: (query) => {
      const connectors = query.state.data;
      if (connectors?.some((c) => c.status === "syncing")) return 4000;
      return false;
    },
  });
}

export function useCreateConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateConnectorPayload) => {
      const { data } = await api.post<{ success: boolean; data: Connector }>(
        "/connectors",
        payload
      );
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK });
    },
    onError() {
      toast.error("Failed to add connector");
    },
  });
}

export function useUpdateConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string } & UpdateConnectorPayload) => {
      const { data } = await api.put<{ success: boolean; data: Connector }>(
        `/connectors/${id}`,
        payload
      );
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Connector updated");
    },
    onError() {
      toast.error("Failed to update connector");
    },
  });
}

export function useDeleteConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/connectors/${id}`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Connector removed");
    },
    onError() {
      toast.error("Failed to remove connector");
    },
  });
}

export function useStartOAuth() {
  return useMutation({
    mutationFn: async ({
      platform,
      connectorId,
    }: {
      platform: string;
      connectorId: string;
    }) => {
      const { data } = await api.get<{
        success: boolean;
        data: { auth_url: string };
      }>(`/connectors/${platform}/auth?connector_id=${connectorId}`);
      return data.data.auth_url;
    },
    onSuccess(url) {
      window.location.href = url;
    },
    onError(err: unknown) {
      // Try to extract the backend's error message
      const msg =
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.detail ||
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.message ||
        "Failed to start OAuth. Check that your platform credentials are set in the server .env file.";

      if (msg === "instagram_not_configured") {
        toast.error(
          "Instagram credentials are not configured. Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in the server .env file.",
          { duration: 10000 }
        );
      } else {
        toast.error(msg, { duration: 8000 });
      }
    },
  });
}
