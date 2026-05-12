"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import { useAuthStore } from "@/stores/authStore";
import type { AuthResponse, User } from "@/types/user";

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<{ success: boolean; data: AuthResponse }>(
        "/auth/login",
        payload
      );
      return data.data;
    },
    onSuccess(data) {
      setAuth(data.user, data.access_token, data.refresh_token);
      toast.success("Welcome back!");
      router.push("/dashboard");
    },
    onError() {
      toast.error("Invalid email or password");
    },
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  const router = useRouter();
  console.log('user is')

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      console.log('user is', payload)
      const { data } = await api.post<{ success: boolean; data: AuthResponse }>(
        "/auth/register",
        payload
      );
      return data.data;
    },
    onSuccess(data) {
      setAuth(data.user, data.access_token, data.refresh_token);
      toast.success("Account created!");
      router.push("/dashboard");
    },
    onError() {
      toast.error("Registration failed. Please try again.");
    },
  });
}

export function useLogout() {
  const { clearAuth } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout");
    },
    onSettled() {
      clearAuth();
      queryClient.clear();
      router.push("/login");
    },
  });
}

export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: User }>("/auth/me");
      return data.data;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: async (payload: { name?: string; email?: string }) => {
      const { data } = await api.put<{ success: boolean; data: User }>("/auth/me", payload);
      return data.data;
    },
    onSuccess(user) {
      // Tokens live in localStorage (not Zustand state) — read them directly
      const token        = localStorage.getItem("access_token")  ?? "";
      const refreshToken = localStorage.getItem("refresh_token") ?? "";
      setAuth(user, token, refreshToken);          // ← updates persisted Zustand store
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile updated!");
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to update profile.");
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (payload: { current_password: string; new_password: string }) => {
      const { data } = await api.put<{ success: boolean; message: string }>("/auth/password", payload);
      return data;
    },
    onSuccess() {
      toast.success("Password changed. Please log in again.");
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to change password.");
    },
  });
}
