"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export function useTeamEmailPrefs(teamId: string, enabled = true) {
  return useQuery<Record<string, boolean>>({
    queryKey: ["team-email-prefs", teamId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: { email_types: Record<string, boolean> } }>(
        `/teams/${teamId}/email-prefs`
      );
      return data.data.email_types;
    },
    enabled: enabled && !!teamId,
    staleTime: 30_000,
  });
}

export function useUpdateTeamEmailPrefs(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email_types: Record<string, boolean>) => {
      const { data } = await api.put<{ success: boolean; data: { email_types: Record<string, boolean> } }>(
        `/teams/${teamId}/email-prefs`,
        { email_types }
      );
      return data.data.email_types;
    },
    onSuccess: () => {
      toast.success("Team email settings saved");
      qc.invalidateQueries({ queryKey: ["team-email-prefs", teamId] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Failed to save team email settings");
    },
  });
}
