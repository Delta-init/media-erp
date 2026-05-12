"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Loader2,
  MessageSquare,
  Search,
  Send,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  useAdminConversations,
  useAdminMessages,
  useChatMessages,
  useChatSocket,
  useChatUsers,
  useUnreadCounts,
} from "@/hooks/useChat";
import type { ChatMessage, ChatUser, ConversationPair } from "@/types/chat";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtRelative(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function groupByDate(msgs: ChatMessage[]) {
  const groups: { date: string; msgs: ChatMessage[] }[] = [];
  for (const m of msgs) {
    const d = fmtDate(m.created_at);
    if (!groups.length || groups[groups.length - 1].date !== d)
      groups.push({ date: d, msgs: [m] });
    else groups[groups.length - 1].msgs.push(m);
  }
  return groups;
}

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function Avatar({
  name,
  online,
  size = "md",
  active = false,
  color = "default",
}: {
  name: string;
  online?: boolean;
  size?: "sm" | "md";
  active?: boolean;
  color?: "default" | "amber";
}) {
  const sz = size === "sm" ? "size-8" : "size-10";
  const dot = size === "sm" ? "size-2 ring-1" : "size-2.5 ring-2";
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          sz,
          "flex items-center justify-center rounded-full text-xs font-bold select-none",
          color === "amber"
            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            : active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {initials(name)}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-background",
            dot,
            online ? "bg-emerald-500" : "bg-muted-foreground/30"
          )}
        />
      )}
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({
  msg,
  isOwn,
  monitorMode = false,
  allUsers,
}: {
  msg: ChatMessage;
  isOwn: boolean;
  monitorMode?: boolean;
  allUsers?: Record<string, string>; // id → name map for monitor mode
}) {
  const senderLabel = monitorMode && allUsers
    ? (allUsers[msg.from_user_id] ?? "Unknown")
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 36 }}
      className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}
    >
      {senderLabel && (
        <span className="mb-0.5 text-[10px] font-medium text-muted-foreground px-1">
          {senderLabel}
        </span>
      )}
      <div
        className={cn(
          "max-w-[72%] rounded-2xl px-4 py-2.5",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-[5px] shadow-sm"
            : "bg-card border text-foreground rounded-bl-[5px] shadow-sm"
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {msg.content}
        </p>
        <p
          className={cn(
            "mt-0.5 text-right text-[10px]",
            isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
          )}
        >
          {fmtTime(msg.created_at)}
          {isOwn && !monitorMode && (
            <span className="ml-1">{msg.read ? "✓✓" : "✓"}</span>
          )}
        </p>
      </div>
    </motion.div>
  );
}

// ── My-chat window ────────────────────────────────────────────────────────────

function MyChatWindow({
  partner,
  myId,
  sendMessage,
}: {
  partner: ChatUser;
  myId: string;
  sendMessage: (to: string, text: string) => void;
}) {
  const { data: messages = [], isLoading } = useChatMessages(partner.id);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    sendMessage(partner.id, t);
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
  }, [text, partner.id, sendMessage]);

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0 border-b bg-card/60 px-5 py-3.5">
        <Avatar name={partner.name} online={partner.online} size="sm" />
        <div>
          <p className="text-sm font-semibold leading-tight">{partner.name}</p>
          <p className={cn("text-[11px]", partner.online ? "text-emerald-500 font-medium" : "text-muted-foreground")}>
            {partner.online ? "Online" : partner.designation || partner.email}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground/50" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/40">
            <MessageSquare className="size-10" />
            <div className="text-center">
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs mt-0.5">Say hi to {partner.name.split(" ")[0]}! 👋</p>
            </div>
          </div>
        ) : (
          groupByDate(messages).map((g) => (
            <div key={g.date}>
              <DateSeparator label={g.date} />
              <div className="space-y-1.5">
                {g.msgs.map((m) => (
                  <Bubble key={m.id} msg={m} isOwn={m.from_user_id === myId} />
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t bg-card/60 px-4 py-3">
        <div className="flex items-end gap-2.5">
          <textarea
            ref={taRef}
            value={text}
            onChange={onInput}
            onKeyDown={onKey}
            placeholder={`Message ${partner.name.split(" ")[0]}…`}
            rows={1}
            className="flex-1 resize-none overflow-hidden rounded-2xl border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 transition"
            style={{ minHeight: "42px", maxHeight: "120px" }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            className={cn(
              "flex size-[42px] shrink-0 items-center justify-center rounded-2xl transition-all",
              text.trim()
                ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-sm"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-center text-[10px] text-muted-foreground/35">
          Enter to send · Shift + Enter for new line
        </p>
      </div>
    </div>
  );
}

// ── Monitor: conversation row ─────────────────────────────────────────────────

function ConvRow({
  conv,
  selected,
  onClick,
}: {
  conv: ConversationPair;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left",
        "cursor-pointer transition-all duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary/40",
        selected ? "bg-amber-500/10" : "hover:bg-muted/70 active:bg-muted"
      )}
    >
      {/* Overlapping avatars */}
      <div className="relative shrink-0 h-10 w-12">
        <div className="absolute left-0 top-0">
          <Avatar name={conv.user_a_name} size="sm" color="amber" />
        </div>
        <div className="absolute left-4 top-0 ring-2 ring-background rounded-full">
          <Avatar name={conv.user_b_name} size="sm" color="amber" />
        </div>
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-xs font-semibold truncate", selected ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
            {conv.user_a_name}
            <span className="mx-1 opacity-50">↔</span>
            {conv.user_b_name}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {fmtRelative(conv.last_at)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {conv.last_message || "No messages"}
        </p>
        <span className="text-[10px] text-muted-foreground/50">
          {conv.msg_count} message{conv.msg_count !== 1 ? "s" : ""}
        </span>
      </div>
    </button>
  );
}

// ── Monitor: read-only thread ─────────────────────────────────────────────────

function MonitorThread({ conv }: { conv: ConversationPair }) {
  const { data: messages = [], isLoading } = useAdminMessages(conv.user_a_id, conv.user_b_id);
  const endRef = useRef<HTMLDivElement>(null);
  const userNames: Record<string, string> = {
    [conv.user_a_id]: conv.user_a_name,
    [conv.user_b_id]: conv.user_b_name,
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Monitoring banner */}
      <div className="shrink-0 flex items-center gap-3 border-b bg-amber-500/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-10 shrink-0">
            <div className="absolute left-0"><Avatar name={conv.user_a_name} size="sm" color="amber" /></div>
            <div className="absolute left-4 ring-2 ring-background rounded-full"><Avatar name={conv.user_b_name} size="sm" color="amber" /></div>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">
              {conv.user_a_name}
              <span className="mx-1.5 text-muted-foreground font-normal">↔</span>
              {conv.user_b_name}
            </p>
            <p className="text-[11px] text-muted-foreground">{conv.msg_count} messages total</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          <Eye className="size-3" />
          Monitoring
        </div>
      </div>

      {/* Messages (read-only) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground/50" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <MessageSquare className="size-8" />
            <p className="text-sm">No messages in this conversation</p>
          </div>
        ) : (
          groupByDate(messages).map((g) => (
            <div key={g.date}>
              <DateSeparator label={g.date} />
              <div className="space-y-2">
                {g.msgs.map((m) => (
                  <Bubble
                    key={m.id}
                    msg={m}
                    isOwn={m.from_user_id === conv.user_a_id}
                    monitorMode
                    allUsers={userNames}
                  />
                ))}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Read-only footer */}
      <div className="shrink-0 border-t bg-amber-500/5 px-5 py-3">
        <div className="flex items-center justify-center gap-2 text-[11px] text-amber-600/70 dark:text-amber-400/70">
          <ShieldAlert className="size-3.5" />
          Read-only monitoring · Messages refresh every 8 seconds
        </div>
      </div>
    </div>
  );
}

// ── Monitor panel (left list for Super Admin) ─────────────────────────────────

function MonitorPanel({
  selected,
  onSelect,
}: {
  selected: ConversationPair | null;
  onSelect: (c: ConversationPair) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: convs = [], isLoading, isError } = useAdminConversations(true);

  const filtered = convs.filter(
    (c) =>
      c.user_a_name.toLowerCase().includes(search.toLowerCase()) ||
      c.user_b_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col w-72 shrink-0 border-r">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b bg-amber-500/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Eye className="size-3.5 text-amber-500" />
              <h2 className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                Monitor All Chats
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLoading ? "Loading…" : `${convs.length} conversation${convs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="size-4" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
            className="w-full rounded-lg bg-muted/50 pl-8 pr-8 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition"
          />
          <AnimatePresence>
            {search && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="size-3 text-muted-foreground" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground/50" />
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-xs text-red-500/70">Failed to load conversations.</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {search ? `No results for "${search}"` : "No conversations yet"}
          </p>
        ) : (
          filtered.map((c) => (
            <ConvRow
              key={`${c.user_a_id}___${c.user_b_id}`}
              conv={c}
              selected={
                selected?.user_a_id === c.user_a_id &&
                selected?.user_b_id === c.user_b_id
              }
              onClick={() => onSelect(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── People panel (left list for normal chat) ──────────────────────────────────

function PeoplePanel({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: users = [], isLoading, isError } = useChatUsers();
  const { data: unread = {} } = useUnreadCounts();

  const sorted = [...users]
    .filter(
      (u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const onlineCount = users.filter((u) => u.online).length;

  return (
    <div className="flex flex-col w-72 shrink-0 border-r bg-card/30">
      <div className="shrink-0 px-4 py-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">People</h2>
            {!isLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {users.length} teammate{users.length !== 1 ? "s" : ""}
                {onlineCount > 0 && (
                  <span className="text-emerald-500 font-medium">
                    {" · "}{onlineCount} online
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Users className="size-4" />
          </div>
        </div>
      </div>

      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teammates…"
            className="w-full rounded-lg bg-muted/50 pl-8 pr-8 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
          <AnimatePresence>
            {search && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="size-3 text-muted-foreground" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 space-y-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground/50" />
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-xs text-red-500/70">
            Could not load teammates. Try refreshing.
          </p>
        ) : sorted.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {search ? `No results for "${search}"` : "No other teammates"}
          </p>
        ) : (
          sorted.map((u) => (
            <PersonRow
              key={u.id}
              user={u}
              selected={selectedId === u.id}
              unread={unread[u.id] ?? 0}
              onClick={() => onSelect(u.id)}
            />
          ))
        )}
      </div>

      {!selectedId && sorted.length > 0 && (
        <div className="shrink-0 border-t px-4 py-3">
          <p className="text-[11px] text-center text-muted-foreground/50">
            👆 Click a person to start chatting
          </p>
        </div>
      )}
    </div>
  );
}

// ── PersonRow (used inside PeoplePanel) ───────────────────────────────────────

function PersonRow({
  user,
  selected,
  unread,
  onClick,
}: {
  user: ChatUser;
  selected: boolean;
  unread: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left",
        "cursor-pointer transition-all duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary/40",
        selected ? "bg-primary/10 shadow-sm" : "hover:bg-muted/70 active:bg-muted"
      )}
    >
      <Avatar name={user.name} online={user.online} active={selected} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm font-medium truncate", selected ? "text-primary" : "text-foreground")}>
            {user.name}
          </span>
          {unread > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={cn("text-xs", user.online ? "text-emerald-500 font-medium" : "text-muted-foreground")}>
            {user.online ? "Online" : "Offline"}
          </span>
          {!user.online && user.designation && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground truncate">{user.designation}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const me = useAuthStore((s) => s.user);
  const myId = me?.id ?? null;

  // Super Admin check — mirrors authStore.hasPermission logic
  const isSuperAdmin =
    !!me?.role?.is_system_role && me?.role?.role_name === "Super Admin";

  // Mode: "chat" = normal,  "monitor" = Super Admin surveillance
  const [mode, setMode] = useState<"chat" | "monitor">("chat");

  // Normal chat state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: users = [] } = useChatUsers();
  const { sendMessage, sendRead } = useChatSocket(myId);

  // Monitor state
  const [selectedConv, setSelectedConv] = useState<ConversationPair | null>(null);

  // Mark as read when switching conversation
  useEffect(() => {
    if (selectedUserId) sendRead(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  // Reset selections when switching modes
  function switchMode(m: "chat" | "monitor") {
    setMode(m);
    setSelectedUserId(null);
    setSelectedConv(null);
  }

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  return (
    <div
      className="-m-6 flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* ── Mode toggle bar (Super Admin only) ─────────────────────────── */}
      {isSuperAdmin && (
        <div className="shrink-0 flex items-center gap-1 border-b bg-card/60 px-4 py-2">
          <button
            type="button"
            onClick={() => switchMode("chat")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              mode === "chat"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <MessageSquare className="size-3.5" />
            My Chats
          </button>
          <button
            type="button"
            onClick={() => switchMode("monitor")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              mode === "monitor"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Eye className="size-3.5" />
            Monitor All Chats
          </button>
          {mode === "monitor" && (
            <span className="ml-auto text-[11px] text-amber-600/70 dark:text-amber-400/70 font-medium">
              Super Admin surveillance mode
            </span>
          )}
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {mode === "monitor" ? (
            <motion.div
              key="monitor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 min-h-0"
            >
              {/* Monitor left panel */}
              <MonitorPanel selected={selectedConv} onSelect={setSelectedConv} />

              {/* Monitor right panel */}
              <div className="flex flex-1 min-w-0 min-h-0 bg-muted/10">
                <AnimatePresence mode="wait">
                  {selectedConv ? (
                    <motion.div
                      key={`${selectedConv.user_a_id}___${selectedConv.user_b_id}`}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-1 min-h-0"
                    >
                      <MonitorThread conv={selectedConv} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="monitor-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground/40"
                    >
                      <div className="flex size-20 items-center justify-center rounded-3xl bg-amber-500/10">
                        <Eye className="size-9 text-amber-500/50" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-muted-foreground/60">
                          Select a conversation to monitor
                        </p>
                        <p className="text-xs text-muted-foreground/40">
                          All messages between teammates are visible here
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 min-h-0"
            >
              {/* Normal chat left panel */}
              <PeoplePanel selectedId={selectedUserId} onSelect={setSelectedUserId} />

              {/* Normal chat right panel */}
              <div className="flex flex-1 min-w-0 min-h-0 bg-muted/10">
                <AnimatePresence mode="wait">
                  {selectedUser && myId ? (
                    <motion.div
                      key={selectedUser.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-1 min-h-0"
                    >
                      <MyChatWindow
                        partner={selectedUser}
                        myId={myId}
                        sendMessage={sendMessage}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="chat-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground/40"
                    >
                      <div className="flex size-20 items-center justify-center rounded-3xl bg-muted/50">
                        <MessageSquare className="size-9" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-muted-foreground/60">No conversation open</p>
                        <p className="text-xs text-muted-foreground/40">
                          Select a person from the left to start chatting
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
