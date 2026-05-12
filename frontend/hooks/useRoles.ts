"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type { Role } from "@/types/role";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RolesListParams {
  search?: string;
  page?: number;
  limit?: number;
}

interface RolesListResponse {
  roles: Role[];
  total: number;
  page: number;
  pages: number;
}

export interface SimpleRole {
  id: string;
  role_name: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useRoles(params: RolesListParams = {}) {
  const { search = "", page = 1, limit = 20 } = params;
  return useQuery<RolesListResponse>({
    queryKey: ["roles", search, page, limit],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: RolesListResponse }>("/roles", {
        params: { search, page, limit },
      });
      return data.data;
    },
  });
}

export function useRolesSimple() {
  return useQuery<SimpleRole[]>({
    queryKey: ["roles-simple"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: SimpleRole[] }>("/roles/all");
      return data.data;
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      role_name: string;
      description?: string;
      permissions?: Record<string, object>;
    }) => {
      const { data } = await api.post<{ success: boolean; data: Role }>("/roles", payload);
      return data.data;
    },
    onSuccess: () => {
      toast.success("Role created");
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["roles-simple"] });
    },
    onError: () => toast.error("Failed to create role"),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        role_name?: string;
        description?: string;
        permissions?: Record<string, object>;
      };
    }) => {
      const { data } = await api.put<{ success: boolean; data: Role }>(`/roles/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["roles-simple"] });
    },
    onError: () => toast.error("Failed to update role"),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/roles/${id}`);
    },
    onSuccess: () => {
      toast.success("Role deleted");
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["roles-simple"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Failed to delete role";
      toast.error(msg);
    },
  });
}
