"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export interface NotificationPrefs {
  email_enabled: boolean;
  email_types: Record<string, boolean>;
}

export function useNotificationPrefs() {
  return useQuery<NotificationPrefs>({
    queryKey: ["notification-prefs"],
    queryFn: async () => {
      const { data } = await api.get("/notification-prefs");
      return data.data;
    },
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<NotificationPrefs>) => {
      const { data } = await api.put("/notification-prefs", payload);
      return data;
    },
    onSuccess: () => {
      toast.success("Notification preferences saved");
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || "Failed to save preferences");
    },
  });
}
