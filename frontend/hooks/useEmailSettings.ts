"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  configured?: boolean;
}

export function useEmailSettings() {
  return useQuery<SmtpConfig>({
    queryKey: ["email-settings"],
    queryFn: async () => {
      const { data } = await api.get("/settings/email-smtp");
      return data.data;
    },
  });
}

export function useUpdateEmailSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SmtpConfig>) => {
      const { data } = await api.put("/settings/email-smtp", payload);
      return data;
    },
    onSuccess: () => {
      toast.success("Email settings saved");
      qc.invalidateQueries({ queryKey: ["email-settings"] });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to save settings";
      toast.error(msg);
    },
  });
}

export function useTestEmail() {
  return useMutation({
    mutationFn: async (to?: string) => {
      const { data } = await api.post("/settings/email-smtp/test", { to });
      return data;
    },
    onSuccess: (_data, to) => {
      toast.success(to ? `Test email sent to ${to}` : "Test email sent");
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || "SMTP test failed — check your settings");
    },
  });
}
