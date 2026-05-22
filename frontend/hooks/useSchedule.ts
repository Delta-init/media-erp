"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

export interface ScheduledPost {
  id: string;
  connector_id: string;
  platform: string;
  caption: string;
  image_url?: string;
  video_url?: string;
  scheduled_at: string;
  status: "pending" | "published" | "failed" | "cancelled";
  published_at?: string;
  error?: string;
  page_id?: string;
  ig_user_id?: string;
  created_at: string;
}

export function useScheduledPosts(params?: {
  status?: string;
  platform?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["schedule", "posts", params],
    queryFn: async () => {
      const { data } = await api.get<{
        success: boolean;
        data: { posts: ScheduledPost[]; total: number };
      }>("/schedule/posts", { params });
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useCreateScheduledPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      connector_id: string;
      platform: string;
      caption: string;
      image_url?: string;
      video_url?: string;
      scheduled_at: string;
      page_id?: string;
      ig_user_id?: string;
    }) => {
      const { data } = await api.post("/schedule/posts", body);
      return data;
    },
    onSuccess() {
      toast.success("Post scheduled!");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(msg ?? "Failed to schedule post");
    },
  });
}

export function useUpdateScheduledPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      scheduled_at?: string;
      caption?: string;
      image_url?: string;
      video_url?: string;
    }) => {
      const { data } = await api.patch(`/schedule/posts/${id}`, body);
      return data;
    },
    onSuccess() {
      toast.success("Post updated");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError() {
      toast.error("Failed to update scheduled post");
    },
  });
}

export function useCancelScheduledPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/schedule/posts/${id}`);
    },
    onSuccess() {
      toast.success("Post cancelled");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError() {
      toast.error("Failed to cancel post");
    },
  });
}
