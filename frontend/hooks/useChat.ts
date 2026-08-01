"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type {
  ChatAttachment,
  ChatGroup,
  ChatMessage,
  ChatUser,
  ConversationPair,
  GroupMessage,
  TaskRef,
  WsIncoming,
} from "@/types/chat";

export interface SendExtras {
  attachments?: ChatAttachment[];
  taskIds?: string[];
}

function newClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface Mergeable {
  id: string;
  content: string;
  from_user_id: string;
  created_at: string;
  client_id?: string;
  status?: "sending" | "sent";
}

/**
 * Merge a fresh REST snapshot with whatever's already cached, instead of
 * overwriting it outright. A GET can resolve *after* the WebSocket has
 * already pushed a newer message into the cache (e.g. the request was in
 * flight when a message arrived, or fired again on refocus/remount while
 * one was mid-send) — a plain replace would silently wipe that message
 * until some later fetch happens to include it again. Real messages are
 * never deleted server-side; this was purely a client-side render race.
 */
function mergeMessages<T extends Mergeable>(prev: T[], fresh: T[]): T[] {
  const byId = new Map<string, T>();
  for (const m of prev) byId.set(m.id, m);

  for (const m of fresh) {
    // A still-"sending" optimistic entry has no counterpart in `fresh`
    // (REST never echoes a client_id) — reconcile it by sender + content
    // so the confirmed message doesn't show up as a duplicate alongside
    // its own optimistic placeholder while waiting for the WS echo.
    for (const [k, v] of byId) {
      if (
        v.status === "sending" &&
        v.from_user_id === m.from_user_id &&
        v.content === m.content &&
        k !== m.id
      ) {
        byId.delete(k);
        break;
      }
    }
    byId.set(m.id, m);
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
}

// ── REST queries ──────────────────────────────────────────────────────────────

export function useChatUsers() {
  return useQuery<ChatUser[]>({
    queryKey: ["chat", "users"],
    queryFn: () => api.get("/chat/users").then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

/** Tasks the current user can reference (@mention) in chat. */
export function useMentionableTasks(search: string) {
  return useQuery<TaskRef[]>({
    queryKey: ["chat", "mention-tasks", search],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Array<{ id: string; title: string; status: string; priority: string }> }>(
        "/projects",
        { params: search ? { search } : {} }
      );
      return (data.data ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
      }));
    },
    staleTime: 15_000,
  });
}

export function useChatMessages(otherId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["chat", "messages", otherId] as const;
  return useQuery<ChatMessage[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<ChatMessage[]>(`/chat/messages/${otherId}`);
      const prev = qc.getQueryData<ChatMessage[]>(queryKey) ?? [];
      return mergeMessages(prev, data);
    },
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

// ── Group chat ────────────────────────────────────────────────────────────────

export function useGroups() {
  return useQuery<ChatGroup[]>({
    queryKey: ["chat", "groups"],
    queryFn: () => api.get("/chat/groups").then((r) => r.data),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
}

export function useGroupMessages(groupId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["chat", "group-messages", groupId] as const;
  return useQuery<GroupMessage[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<GroupMessage[]>(`/chat/groups/${groupId}/messages`);
      const prev = qc.getQueryData<GroupMessage[]>(queryKey) ?? [];
      return mergeMessages(prev, data);
    },
    enabled: !!groupId,
    // Poll so the automated 9 PM IST report (posted by the backend daemon) shows up
    refetchInterval: 12_000,
    staleTime: 0,
  });
}

export type ReportPeriod = "daily" | "weekly" | "monthly";

export const REPORT_PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "daily",   label: "Daily report" },
  { value: "weekly",  label: "Weekly report" },
  { value: "monthly", label: "Monthly report" },
];

export function useSendGroupReportNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, period }: { groupId: string; period: ReportPeriod }) =>
      api
        .post(`/chat/groups/${groupId}/report/send-now`, null, { params: { period } })
        .then((r) => r.data),
    onSuccess: (_data, { groupId, period }) => {
      qc.invalidateQueries({ queryKey: ["chat", "group-messages", groupId] });
      qc.invalidateQueries({ queryKey: ["chat", "groups"] });
      const label = REPORT_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Report";
      toast.success(`${label} posted to the group`);
    },
    onError: () => toast.error("Failed to post report"),
  });
}

/** Download a team's report as a PDF (default: monthly) without posting it to chat. */
export function useExportGroupReportPdf() {
  return useMutation({
    mutationFn: async ({
      groupId,
      groupName,
      period = "monthly",
    }: {
      groupId: string;
      groupName: string;
      period?: ReportPeriod;
    }) => {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/v1/chat/groups/${groupId}/report/export/pdf?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { detail?: string }).detail ?? "Export failed");
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${groupName.trim().toLowerCase().replace(/\s+/g, "_")}_${period}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    },
    onSuccess: () => toast.success("Report PDF downloaded"),
    onError: (e: Error) => toast.error(e.message || "Failed to export PDF"),
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
  const qc = useQueryClient();
  const queryKey = ["chat", "admin", "messages", userAId, userBId] as const;
  return useQuery<ChatMessage[]>({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<ChatMessage[]>(`/chat/admin/messages/${userAId}/${userBId}`);
      const prev = qc.getQueryData<ChatMessage[]>(queryKey) ?? [];
      return mergeMessages(prev, data);
    },
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

    // Same-origin, like every other API call — the browser never learns the
    // backend's real host. next.config.ts rewrites /api/v1/* (including this
    // WebSocket upgrade) to the backend server-side.
    const wsBase = window.location.origin.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/api/v1/chat/ws?token=${encodeURIComponent(token)}`);
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
        const msg = { ...(data as ChatMessage & { type: "message" }), status: "sent" as const };
        const partnerId =
          msg.from_user_id === currentUserId
            ? msg.to_user_id
            : msg.from_user_id;

        // Reconcile an optimistic message (matched by client_id) or append
        qc.setQueryData<ChatMessage[]>(
          ["chat", "messages", partnerId],
          (prev = []) => {
            if (msg.client_id) {
              const idx = prev.findIndex(
                (m) => m.client_id === msg.client_id || m.id === msg.client_id
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = msg;
                return next;
              }
            }
            return prev.some((m) => m.id === msg.id) ? prev : [...prev, msg];
          }
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
      } else if (data.type === "read") {
        // The partner (data.by) read our messages → flip our ✓ to ✓✓
        qc.setQueryData<ChatMessage[]>(
          ["chat", "messages", data.by],
          (prev = []) =>
            prev.map((m) =>
              m.from_user_id === currentUserId ? { ...m, read: true } : m
            )
        );
      } else if (data.type === "group_message") {
        const gm = { ...(data as GroupMessage & { type: "group_message" }), status: "sent" as const };
        qc.setQueryData<GroupMessage[]>(
          ["chat", "group-messages", gm.group_id],
          (prev = []) => {
            if (gm.client_id) {
              const idx = prev.findIndex(
                (m) => m.client_id === gm.client_id || m.id === gm.client_id
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = gm;
                return next;
              }
            }
            return prev.some((m) => m.id === gm.id) ? prev : [...prev, gm];
          }
        );
        // Refresh the group list preview
        qc.invalidateQueries({ queryKey: ["chat", "groups"] });
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
    (toUserId: string, content: string, extras?: SendExtras) => {
      const clientId = newClientId();
      // Optimistic: show the message instantly with a "sending" state
      if (currentUserId) {
        const optimistic: ChatMessage = {
          id: clientId,
          client_id: clientId,
          from_user_id: currentUserId,
          to_user_id: toUserId,
          content,
          read: false,
          attachments: extras?.attachments ?? [],
          task_ids: extras?.taskIds ?? [],
          tasks: [],
          status: "sending",
          created_at: new Date().toISOString(),
        };
        qc.setQueryData<ChatMessage[]>(["chat", "messages", toUserId], (prev = []) => [
          ...prev,
          optimistic,
        ]);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "message",
            to_user_id: toUserId,
            content,
            attachments: extras?.attachments ?? [],
            task_ids: extras?.taskIds ?? [],
            client_id: clientId,
          })
        );
      }
    },
    [currentUserId, qc]
  );

  const sendGroupMessage = useCallback(
    (groupId: string, content: string, extras?: SendExtras) => {
      const clientId = newClientId();
      if (currentUserId) {
        const optimistic: GroupMessage = {
          id: clientId,
          client_id: clientId,
          group_id: groupId,
          from_user_id: currentUserId,
          from_user_name: "",
          content,
          is_system: false,
          attachments: extras?.attachments ?? [],
          task_ids: extras?.taskIds ?? [],
          tasks: [],
          status: "sending",
          created_at: new Date().toISOString(),
        };
        qc.setQueryData<GroupMessage[]>(["chat", "group-messages", groupId], (prev = []) => [
          ...prev,
          optimistic,
        ]);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "group_message",
            group_id: groupId,
            content,
            attachments: extras?.attachments ?? [],
            task_ids: extras?.taskIds ?? [],
            client_id: clientId,
          })
        );
      }
    },
    [currentUserId, qc]
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

  return { sendMessage, sendGroupMessage, sendRead };
}
