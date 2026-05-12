"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

// ── Facebook Pages ────────────────────────────────────────────────────────────

export function useFacebookPages(connectorId: string) {
  return useQuery({
    queryKey: ["facebook-pages", connectorId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: FacebookPage[] }>(
        `/social/facebook/pages?connector_id=${connectorId}`
      );
      return data.data;
    },
    enabled: !!connectorId,
  });
}

export function usePublishFacebookPost() {
  return useMutation({
    mutationFn: async (payload: {
      connector_id: string;
      page_id: string;
      message: string;
      link?: string;
      image_url?: string;
    }) => {
      const { data } = await api.post("/social/facebook/post", payload);
      return data;
    },
    onSuccess() {
      toast.success("Post published to Facebook!");
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to publish Facebook post");
    },
  });
}

export function useSendFacebookDM() {
  return useMutation({
    mutationFn: async (payload: {
      connector_id: string;
      page_id: string;
      recipient_id: string;
      message: string;
    }) => {
      const { data } = await api.post("/social/facebook/dm", payload);
      return data;
    },
    onSuccess() {
      toast.success("Facebook DM sent!");
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to send Facebook DM");
    },
  });
}

// ── Instagram ─────────────────────────────────────────────────────────────────

export function useInstagramAccounts(connectorId: string) {
  return useQuery({
    queryKey: ["instagram-accounts", connectorId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: InstagramAccount[] }>(
        `/social/instagram/accounts?connector_id=${connectorId}`
      );
      return data.data;
    },
    enabled: !!connectorId,
  });
}

export function usePublishInstagramPost() {
  return useMutation({
    mutationFn: async (payload: {
      connector_id: string;
      ig_id: string;
      page_token: string;
      caption: string;
      image_url?: string;
      video_url?: string;
    }) => {
      const { data } = await api.post("/social/instagram/post", payload);
      return data;
    },
    onSuccess() {
      toast.success("Post published to Instagram!");
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to publish Instagram post");
    },
  });
}

export function useSendInstagramDM() {
  return useMutation({
    mutationFn: async (payload: {
      connector_id: string;
      ig_id: string;
      page_token: string;
      recipient_id: string;
      message: string;
    }) => {
      const { data } = await api.post("/social/instagram/dm", payload);
      return data;
    },
    onSuccess() {
      toast.success("Instagram DM sent!");
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to send Instagram DM");
    },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
}

export interface InstagramAccount {
  page_id: string;
  page_name: string;
  page_token: string;
  ig_id: string;
  ig_name: string;
  ig_username: string;
  ig_picture: string;
}
