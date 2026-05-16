"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type {
  TriggerSyncData,
  SyncStatusData,
  SyncHistoryData,
} from "@/types/sync";

// ── Query keys ────────────────────────────────────────────────────────────────

export const syncKeys = {
  status:  (id: string) => ["sync", "status",  id] as const,
  history: (id: string) => ["sync", "history", id] as const,
};

// ── Trigger manual sync ───────────────────────────────────────────────────────

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (connectorId: string) => {
      const { data } = await api.post<{ success: boolean; data: TriggerSyncData }>(
        `/sync/trigger/${connectorId}`
      );
      return data.data;
    },
    onSuccess(_, connectorId) {
      toast.success("Sync started");
      // Refresh connector list so card shows "syncing" status immediately
      qc.invalidateQueries({ queryKey: ["connectors"] });
      // Prime the status query for this connector
      qc.invalidateQueries({ queryKey: syncKeys.status(connectorId) });
    },
    onError(err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to trigger sync");
    },
  });
}

// ── Sync status (polls while syncing) ────────────────────────────────────────

export function useSyncStatus(connectorId: string, enabled = true) {
  return useQuery({
    queryKey: syncKeys.status(connectorId),
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: SyncStatusData }>(
        `/sync/status/${connectorId}`
      );
      return data.data;
    },
    enabled,
    // Auto-poll every 3 s while the connector is syncing; stop otherwise
    refetchInterval: (query) => {
      const status = query.state.data?.connector?.status;
      return status === "syncing" ? 3000 : false;
    },
  });
}

// ── Sync history ──────────────────────────────────────────────────────────────

export function useSyncHistory(connectorId: string, enabled = false) {
  return useQuery({
    queryKey: syncKeys.history(connectorId),
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: SyncHistoryData }>(
        `/sync/history/${connectorId}?limit=20`
      );
      return data.data;
    },
    enabled,
  });
}
