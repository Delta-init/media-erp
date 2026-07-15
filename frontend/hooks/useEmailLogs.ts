"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  status: "sent" | "failed";
  error: string | null;
  from_email: string;
  category: string;
  created_at: string | null;
}

export interface EmailLogsResponse {
  logs: EmailLog[];
  total: number;
  page: number;
  pages: number;
  stats: { sent: number; failed: number; total: number };
}

export interface EmailLogFilters {
  page?: number;
  status?: string;
  category?: string;
  search?: string;
}

export function useEmailLogs(filters: EmailLogFilters, enabled = true) {
  return useQuery<EmailLogsResponse>({
    queryKey: ["email-logs", filters],
    queryFn: async () => {
      const params: Record<string, string | number> = { page: filters.page ?? 1 };
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;
      const { data } = await api.get<{ success: boolean; data: EmailLogsResponse }>(
        "/email-logs",
        { params }
      );
      return data.data;
    },
    enabled,
    refetchInterval: 20_000,
    staleTime: 5_000,
  });
}
