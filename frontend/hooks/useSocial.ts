"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";

// ── Media Upload ──────────────────────────────────────────────────────────────

export function useUploadMedia() {
  return useMutation({
    mutationFn: async (file: File): Promise<{ url: string; filename: string; size: number }> => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<{ success: boolean; data: { url: string; filename: string; size: number } }>(
        "/media/upload",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data.data;
    },
    onError(err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to upload file");
    },
  });
}

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
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
      if (msg.includes("2534014") || msg.toLowerCase().includes("cannot be found")) {
        toast.error(
          "Instagram couldn't find this user. They must have messaged your account within the last 24 hours, and your Meta app must be live (not in Development mode).",
          { duration: 8000 }
        );
      } else {
        toast.error(msg || "Failed to send Instagram DM");
      }
    },
  });
}

// ── Instagram Conversations (via instagram platform / Facebook OAuth) ─────────

export function useInstagramConversations(connectorId: string, igId: string) {
  return useQuery({
    queryKey: ["instagram-conversations", connectorId, igId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Conversation[] }>(
        `/social/instagram/conversations?connector_id=${connectorId}&ig_id=${igId}`
      );
      return data.data;
    },
    enabled: !!connectorId && !!igId,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useInstagramMessages(connectorId: string, igId: string, conversationId: string) {
  return useQuery({
    queryKey: ["instagram-messages", connectorId, igId, conversationId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: ChatMessage[] }>(
        `/social/instagram/conversations/${conversationId}/messages?connector_id=${connectorId}&ig_id=${igId}`
      );
      return data.data;
    },
    enabled: !!connectorId && !!igId && !!conversationId,
    refetchInterval: 10_000,
    retry: 1,
  });
}

// ── Facebook Conversations (Inbox) ───────────────────────────────────────────

export function useFacebookConversations(connectorId: string, pageId: string) {
  return useQuery({
    queryKey: ["facebook-conversations", connectorId, pageId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Conversation[] }>(
        `/social/facebook/conversations?connector_id=${connectorId}&page_id=${pageId}`
      );
      return data.data;
    },
    enabled: !!connectorId && !!pageId,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useFacebookMessages(connectorId: string, pageId: string, conversationId: string) {
  return useQuery({
    queryKey: ["facebook-messages", connectorId, pageId, conversationId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: ChatMessage[] }>(
        `/social/facebook/conversations/${conversationId}/messages?connector_id=${connectorId}&page_id=${pageId}`
      );
      return data.data;
    },
    enabled: !!connectorId && !!pageId && !!conversationId,
    refetchInterval: 10_000,
    retry: 1,
  });
}

// ── Instagram Login Conversations (Inbox) ────────────────────────────────────

export function useInstagramLoginConversations(connectorId: string) {
  return useQuery({
    queryKey: ["instagram-login-conversations", connectorId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Conversation[] }>(
        `/social/instagram_login/conversations?connector_id=${connectorId}`
      );
      return data.data;
    },
    enabled: !!connectorId,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useInstagramLoginMessages(connectorId: string, conversationId: string) {
  return useQuery({
    queryKey: ["instagram-login-messages", connectorId, conversationId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: ChatMessage[] }>(
        `/social/instagram_login/conversations/${conversationId}/messages?connector_id=${connectorId}`
      );
      return data.data;
    },
    enabled: !!connectorId && !!conversationId,
    refetchInterval: 10_000,
    retry: 1,
  });
}

// ── Instagram Login (direct OAuth, no Facebook Page) ─────────────────────────

export function useInstagramLoginAccount(connectorId: string) {
  return useQuery({
    queryKey: ["instagram-login-account", connectorId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: InstagramLoginAccount }>(
        `/social/instagram_login/account?connector_id=${connectorId}`
      );
      return data.data;
    },
    enabled: !!connectorId,
  });
}

export function usePublishInstagramLoginPost() {
  return useMutation({
    mutationFn: async (payload: {
      connector_id: string;
      caption: string;
      image_url?: string;
      video_url?: string;
    }) => {
      const { data } = await api.post("/social/instagram_login/post", payload);
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

export function useSendInstagramLoginDM() {
  return useMutation({
    mutationFn: async (payload: {
      connector_id: string;
      recipient_id: string;
      message: string;
    }) => {
      const { data } = await api.post("/social/instagram_login/dm", payload);
      return data;
    },
    onSuccess() {
      toast.success("Instagram DM sent!");
    },
    onError(err: unknown) {
      const e = err as { response?: { data?: { message?: string; detail?: string } }; message?: string };
      // Prefer the backend's structured message, fall back to raw error
      const msg =
        e?.response?.data?.message ??
        e?.response?.data?.detail ??
        e?.message ??
        "";
      // 100/2534014 = recipient not accessible (Dev mode restriction or wrong IGSID)
      if (msg.includes("2534014") || msg.toLowerCase().includes("cannot be found")) {
        toast.error(
          "Instagram can't reach this user — they must have messaged you within the last 24 h, and your Meta app must be Live (not in Development mode).",
          { duration: 10000 }
        );
      } else if (msg) {
        toast.error(msg, { duration: 8000 });
      } else {
        toast.error("Failed to send Instagram DM");
      }
    },
  });
}

// ── Posts / Media ─────────────────────────────────────────────────────────────

export function useInstagramLoginPosts(connectorId: string) {
  return useQuery({
    queryKey: ["instagram-login-posts", connectorId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: IGPost[] }>(
        `/social/instagram_login/posts?connector_id=${connectorId}&limit=50`
      );
      return data.data;
    },
    enabled: !!connectorId,
    staleTime: 60_000,
  });
}

export function useInstagramLoginPostComments(connectorId: string, postId: string) {
  return useQuery({
    queryKey: ["instagram-login-post-comments", connectorId, postId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: IGComment[] }>(
        `/social/instagram_login/posts/${postId}/comments?connector_id=${connectorId}`
      );
      return data.data;
    },
    enabled: !!connectorId && !!postId,
  });
}

export function useFacebookPosts(connectorId: string, pageId: string) {
  return useQuery({
    queryKey: ["facebook-posts", connectorId, pageId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: FBPost[] }>(
        `/social/facebook/posts?connector_id=${connectorId}&page_id=${pageId}&limit=50`
      );
      return data.data;
    },
    enabled: !!connectorId && !!pageId,
    staleTime: 60_000,
  });
}

export function useFacebookPostComments(connectorId: string, pageId: string, postId: string) {
  return useQuery({
    queryKey: ["facebook-post-comments", connectorId, pageId, postId],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: FBComment[] }>(
        `/social/facebook/posts/${postId}/comments?connector_id=${connectorId}&page_id=${pageId}`
      );
      return data.data;
    },
    enabled: !!connectorId && !!pageId && !!postId,
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

export interface InstagramLoginAccount {
  id: string;
  name: string;
  username: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

export interface ConversationParticipant {
  name: string;
  id: string;
  email?: string;
  username?: string;
  /** Set by backend for instagram_login conversations — true = this is the connected account */
  is_self?: boolean;
}

export interface Conversation {
  id: string;
  participants: { data: ConversationParticipant[] };
  snippet: string;
  updated_time: string;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  message: string;
  from: { name: string; id: string };
  created_time: string;
}

export interface IGPost {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  permalink?: string;
}

export interface IGComment {
  id: string;
  text: string;
  timestamp: string;
  username?: string;
  like_count?: number;
  replies?: { data: IGComment[] };
}

export interface FBPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  full_picture?: string;
  likes?: { data: unknown[]; summary: { total_count: number } };
  comments?: { data: unknown[]; summary: { total_count: number } };
  shares?: { count: number };
}

export interface FBComment {
  id: string;
  message: string;
  from?: { name: string; id: string };
  created_time: string;
  like_count?: number;
}

// ── Instagram Login: Account-level Insights ───────────────────────────────────

export interface IGInsightDay {
  date: string;
  impressions: number;
  reach: number;
  profile_views: number;
}

export interface IGInsightsData {
  daily: IGInsightDay[];
  totals: { impressions: number; reach: number; profile_views: number };
}

export function useInstagramLoginInsights(
  connectorId: string,
  dateFrom?: string,
  dateTo?: string,
) {
  return useQuery({
    queryKey: ["instagram-login-insights", connectorId, dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = { connector_id: connectorId };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      const { data } = await api.get<{ success: boolean; data: IGInsightsData }>(
        "/social/instagram_login/insights",
        { params },
      );
      return data.data;
    },
    enabled: !!connectorId,
    staleTime: 60_000,
  });
}
