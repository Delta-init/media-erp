"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { ChatMessage, ChatUser, ConversationPair, WsIncoming } from "@/types/chat";

// ── REST queries ──────────────────────────────────────────────────────────────

export function useChatUsers() {
  return useQuery<ChatUser[]>({
    queryKey: ["chat", "users"],
    queryFn: () => api.get("/chat/users").then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useChatMessages(otherId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: ["chat", "messages", otherId],
    queryFn: () => api.get(`/chat/messages/${otherId}`).then((r) => r.data),
    enabled: !!otherId,
    staleTime: 0,
  });
}

export function useUnreadCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ["chat", "unread"],
    queryFn: () => api.get("/chat/unread").then((r) => r.data),
    refetchInterval: 20_000,
    staleTime: 5_000,
  });
}

// ── Super Admin monitor ───────────────────────────────────────────────────────

export function useAdminConversations(enabled: boolean) {
  return useQuery<ConversationPair[]>({
    queryKey: ["chat", "admin", "conversations"],
    queryFn: () => api.get("/chat/admin/conversations").then((r) => r.data),
    enabled,
    refetchInterval: 10_000,
    staleTime: 0,
  });
}

export function useAdminMessages(userAId: string | null, userBId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: ["chat", "admin", "messages", userAId, userBId],
    queryFn: () =>
      api.get(`/chat/admin/messages/${userAId}/${userBId}`).then((r) => r.data),
    enabled: !!(userAId && userBId),
    refetchInterval: 8_000,   // live refresh for the admin view
    staleTime: 0,
  });
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export function useChatSocket(currentUserId: string | null) {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (!currentUserId || unmountedRef.current) return;

    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) return;

    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
    const wsBase = base.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/chat/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      let data: WsIncoming;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }

      if (data.type === "online_users") {
        const ids = new Set(data.user_ids);
        qc.setQueryData<ChatUser[]>(["chat", "users"], (prev) =>
          prev?.map((u) => ({ ...u, online: ids.has(u.id) }))
        );
      } else if (data.type === "status") {
        qc.setQueryData<ChatUser[]>(["chat", "users"], (prev) =>
          prev?.map((u) =>
            u.id === data.user_id ? { ...u, online: data.online } : u
          )
        );
      } else if (data.type === "message") {
        const msg = data as ChatMessage & { type: "message" };
        const partnerId =
          msg.from_user_id === currentUserId
            ? msg.to_user_id
            : msg.from_user_id;

        // Append message to the right conversation cache
        qc.setQueryData<ChatMessage[]>(
          ["chat", "messages", partnerId],
          (prev = []) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );

        // Increment unread badge for incoming messages only
        if (msg.from_user_id !== currentUserId) {
          qc.setQueryData<Record<string, number>>(
            ["chat", "unread"],
            (prev = {}) => ({
              ...prev,
              [msg.from_user_id]: (prev[msg.from_user_id] ?? 0) + 1,
            })
          );
        }
      }
    };

    ws.onclose = (evt) => {
      // 4001 = auth rejected by server — don't retry with same bad token
      if (evt.code === 4001) return;
      if (!unmountedRef.current) {
        // Auto-reconnect after 3 s
        retryTimer.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => ws.close();
  }, [currentUserId, qc]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (toUserId: string, content: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "message", to_user_id: toUserId, content })
        );
      }
    },
    []
  );

  const sendRead = useCallback(
    (fromUserId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "read", from_user_id: fromUserId })
        );
      }
      // Immediately clear the badge in cache
      qc.setQueryData<Record<string, number>>(["chat", "unread"], (prev = {}) => {
        const next = { ...prev };
        delete next[fromUserId];
        return next;
      });
    },
    [qc]
  );

  return { sendMessage, sendRead };
}
