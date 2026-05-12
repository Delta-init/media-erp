"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type {
  AiHistoryData,
  AiHistoryItem,
  AiQueryResponse,
} from "@/types/ai";

// ── Query-key factories ───────────────────────────────────────────────────────
const QK = {
  history: (limit = 20, offset = 0) =>
    ["ai", "history", limit, offset] as const,
  historyDetail: (id: string) => ["ai", "history", id] as const,
};

// ── 6.4 useAiQuery — submit a natural-language question ───────────────────────
export function useAiQuery() {
  const qc = useQueryClient();
  const [retryAfter, setRetryAfter] = useState(0); // seconds remaining

  // Countdown tick
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setTimeout(() => setRetryAfter((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [retryAfter]);

  const mutation = useMutation({
    mutationFn: async (question: string): Promise<AiQueryResponse> => {
      const { data } = await api.post<{ success: boolean; data: AiQueryResponse }>(
        "/ai/query",
        { question }
      );
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["ai", "history"] });
      setRetryAfter(0);
    },
    onError(err: {
      response?: { status?: number; data?: { message?: string; errors?: { retry_after?: number } } };
    }) {
      const status  = err?.response?.status;
      const msg     = err?.response?.data?.message ?? "AI query failed.";
      const after   = err?.response?.data?.errors?.retry_after ?? 60;

      if (status === 429) {
        setRetryAfter(after);
        toast.warning(`⏱ Rate limit — Gemini free tier (5 req/min)`, {
          description: `Try again in ${after}s. The countdown shows in the AI panel.`,
          duration: (after + 5) * 1000,
        });
      } else {
        toast.error(msg);
      }
    },
  });

  const submit = useCallback(
    (question: string) => {
      if (retryAfter > 0) return;
      mutation.mutate(question);
    },
    [mutation, retryAfter]
  );

  return { ...mutation, retryAfter, submit };
}

// ── 6.4 useAiHistory — paginated query history ────────────────────────────────
export function useAiHistory(limit = 20, offset = 0) {
  return useQuery({
    queryKey: QK.history(limit, offset),
    queryFn: async (): Promise<AiHistoryData> => {
      const { data } = await api.get<{ success: boolean; data: AiHistoryData }>(
        "/ai/history",
        { params: { limit, offset } }
      );
      return data.data;
    },
    staleTime: 15_000,
  });
}

// ── 6.4 useAiHistoryDetail — single past query with full result ───────────────
export function useAiHistoryDetail(id: string) {
  return useQuery({
    queryKey: QK.historyDetail(id),
    queryFn: async (): Promise<AiQueryResponse> => {
      const { data } = await api.get<{ success: boolean; data: AiQueryResponse }>(
        `/ai/history/${id}`
      );
      return data.data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}
