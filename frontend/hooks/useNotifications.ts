"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type { NotificationsData } from "@/types/notification";

export function useNotifications(limit = 20, unreadOnly = false) {
  return useQuery({
    queryKey: ["notifications", { limit, unreadOnly }],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: NotificationsData }>(
        "/notifications",
        { params: { limit, unread_only: unreadOnly } }
      );
      return data.data;
    },
    refetchInterval: 60_000,   // poll every 60 s
    staleTime:        30_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/notifications/read-all");
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });
}
