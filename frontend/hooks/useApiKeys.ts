"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface CreateApiKeyResult extends ApiKey {
  key: string; // raw key shown only once
}

const QK = {
  all: () => ["api-keys"] as const,
};

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: QK.all(),
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: ApiKey[] }>("/api-keys");
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      scopes: string[];
      expires_days?: number | null;
    }) => {
      const { data } = await api.post<{ success: boolean; data: CreateApiKeyResult }>(
        "/api-keys",
        body
      );
      return data.data;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.all() });
    },
    onError() {
      toast.error("Failed to create API key");
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: QK.all() });
      toast.success("API key revoked");
    },
    onError() {
      toast.error("Failed to revoke API key");
    },
  });
}

export function useToggleApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<{ success: boolean; data: { is_active: boolean } }>(
        `/api-keys/${id}/toggle`
      );
      return data.data;
    },
    onSuccess(result) {
      qc.invalidateQueries({ queryKey: QK.all() });
      toast.success(result.is_active ? "API key enabled" : "API key disabled");
    },
    onError() {
      toast.error("Failed to toggle API key");
    },
  });
}
