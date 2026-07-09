"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type { User } from "@/types/user";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsersListParams {
  search?: string;
  status?: string;
  role_id?: string;
  page?: number;
  limit?: number;
}

interface UsersListResponse {
  users: User[];
  total: number;
  page: number;
  pages: number;
}

interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role_id: string;
  designation?: string;
  status?: "active" | "inactive";
  whatsapp_phone?: string;
}

interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role_id?: string;
  designation?: string;
  status?: "active" | "inactive";
  whatsapp_phone?: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useUsersList(params: UsersListParams = {}) {
  const { search = "", status = "", role_id = "", page = 1, limit = 20 } = params;
  return useQuery<UsersListResponse>({
    queryKey: ["users", search, status, role_id, page, limit],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: UsersListResponse }>("/users", {
        params: { search, status, role_id, page, limit },
      });
      return data.data;
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const { data } = await api.post<{ success: boolean; data: User }>("/users", payload);
      return data.data;
    },
    onSuccess: () => {
      toast.success("User created");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Failed to create user";
      toast.error(msg);
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateUserPayload }) => {
      const { data } = await api.put<{ success: boolean; data: User }>(`/users/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Failed to update user";
      toast.error(msg);
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Failed to delete user";
      toast.error(msg);
    },
  });
}
