"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditLogsParams {
  limit?: number;
  offset?: number;
  action?: string;
  resource_type?: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
}

export function useAuditLogs(params: AuditLogsParams = {}) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: AuditLogsResponse }>(
        "/audit-logs",
        { params }
      );
      return data.data;
    },
  });
}
