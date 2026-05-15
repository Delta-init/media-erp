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
