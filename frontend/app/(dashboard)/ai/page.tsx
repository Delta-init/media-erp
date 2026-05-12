"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles, Send, RefreshCw, Clock, ChevronDown, ChevronRight,
  Database, Plus, MessageSquare, Search, X, Loader2,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAiQuery, useAiHistory, useAiHistoryDetail } from "@/hooks/useAi";
import { cn } from "@/lib/utils";
import type { AiQueryResponse, AiHistoryItem } from "@/types/ai";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Which platform had the highest ROAS?",
  "Show total spend grouped by platform",
  "Top 5 campaigns by spend",
  "Show daily spend for the last 30 days",
  "What is the total clicks by country?",
  "Which campaigns have the best conversion rate?",
];

const CHART_COLORS = ["#6366f1","#22d3ee","#f59e0b","#10b981","#f43f5e","#8b5cf6","#3b82f6","#ec4899"];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type MsgStatus = "loading" | "done" | "error";

interface ChatMsg {
  id: string;
  question: string;
  status: MsgStatus;
  response?: AiQueryResponse;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart / table helpers (shared)
// ─────────────────────────────────────────────────────────────────────────────

function fmtNum(v: unknown): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) < 10) return n.toFixed(2);
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

function detectChart(rows: Record<string, unknown>[]) {
  if (!rows.length) return { shape: "none" as const, xKey: "", yKey: "" };
  const keys = Object.keys(rows[0]);
  const numericKeys = keys.filter((k) => {
    const v = rows[0][k];
    return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)));
  });
  const yKey = numericKeys[0] ?? "";
  const dateKey = keys.find(
    (k) => k === "date" || (k === "_id" && /^\d{4}-\d{2}/.test(String(rows[0][k])))
  );
  if (dateKey && yKey) return { shape: "line" as const, xKey: dateKey, yKey };
  const catKey = keys.find((k) => typeof rows[0][k] === "string" && !numericKeys.includes(k));
  if (catKey && yKey) return { shape: "bar" as const, xKey: catKey, yKey };
  return { shape: "none" as const, xKey: "", yKey: "" };
}

function AutoChart({ rows }: { rows: Record<string, unknown>[] }) {
  const { shape, xKey, yKey } = detectChart(rows);
  if (shape === "none") return null;
  const data = rows.slice(0, 30).map((r) => ({ x: String(r[xKey] ?? ""), y: Number(r[yKey] ?? 0) }));

  if (shape === "line") return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.2} />
            <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="x" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtNum} width={44} />
        <Tooltip formatter={(v: unknown) => [fmtNum(v), yKey]} contentStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="y" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#cg)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={fmtNum} />
        <YAxis type="category" dataKey="x" width={90} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
          tickFormatter={(v: string) => v?.length > 13 ? v.slice(0, 13) + "…" : v} />
        <Tooltip formatter={(v: unknown) => [fmtNum(v), yKey]} contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="y" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto rounded-lg border text-xs">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/40">
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-semibold capitalize text-muted-foreground">
                {c === "_id" ? "group" : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
              {cols.map((c) => <td key={c} className="px-3 py-2 text-foreground/80">{fmtNum(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && (
        <p className="border-t px-3 py-2 text-muted-foreground">Showing 50 of {rows.length} rows</p>
      )}
    </div>
  );
}

function Pipeline({ pipeline }: { pipeline: Record<string, unknown>[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5"><Database className="size-3" />
          Pipeline ({pipeline.length} stage{pipeline.length !== 1 ? "s" : ""})
        </span>
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div key="p" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <pre className="overflow-x-auto border-t bg-muted/30 px-3 py-3 text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(pipeline, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI response content (chart + table + pipeline)
// ─────────────────────────────────────────────────────────────────────────────

function AiContent({ response }: { response: AiQueryResponse }) {
  const hasChart = detectChart(response.result).shape !== "none";
  return (
    <div className="space-y-3 mt-3">
      {hasChart && response.result.length > 0 && (
        <div className="rounded-xl border bg-background/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Visualisation</p>
          <AutoChart rows={response.result} />
        </div>
      )}
      {response.result.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Data · {response.result.length} row{response.result.length !== 1 ? "s" : ""}
          </p>
          <DataTable rows={response.result} />
        </div>
      ) : (
        <div className="flex h-10 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
          No data returned
        </div>
      )}
      <Pipeline pipeline={response.pipeline} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat message bubble pair
// ─────────────────────────────────────────────────────────────────────────────

function ChatBubble({ msg, isNew }: { msg: ChatMsg; isNew?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {/* User */}
      <div className="flex justify-end">
        <motion.div
          initial={isNew ? { opacity: 0, y: 8, scale: 0.97 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm"
        >
          {msg.question}
        </motion.div>
      </div>

      {/* AI */}
      <div className="flex gap-3 items-start">
        <motion.div
          initial={isNew ? { scale: 0 } : false}
          animate={{ scale: 1 }}
          transition={{ delay: 0.08, type: "spring", stiffness: 400, damping: 25 }}
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 mt-0.5"
        >
          <Sparkles className="size-4 text-primary" />
        </motion.div>

        <motion.div
          initial={isNew ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: "spring", stiffness: 300, damping: 28 }}
          className="flex-1 min-w-0"
        >
          {/* Loading */}
          {msg.status === "loading" && (
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-muted/40 px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="size-1.5 rounded-full bg-primary/60"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18 }} />
                ))}
              </span>
              <span className="text-xs text-muted-foreground">Thinking…</span>
            </div>
          )}

          {/* Error */}
          {msg.status === "error" && (
            <div className="rounded-2xl rounded-tl-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {msg.error ?? "Something went wrong. Please try again."}
            </div>
          )}

          {/* Done */}
          {msg.status === "done" && msg.response && (
            <div>
              <div className="rounded-2xl rounded-tl-sm border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
                {msg.response.explanation}
              </div>
              <AiContent response={msg.response} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History detail view (single past query, lazy-loaded)
// ─────────────────────────────────────────────────────────────────────────────

function HistoryView({ item }: { item: AiHistoryItem }) {
  const detail = useAiHistoryDetail(item.id);

  const msg: ChatMsg = {
    id: item.id,
    question: item.question,
    status: detail.isLoading ? "loading" : detail.isError ? "error" : "done",
    response: detail.data,
    error: detail.isError ? "Failed to load this query." : undefined,
  };

  return <ChatBubble msg={msg} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date grouping helper
// ─────────────────────────────────────────────────────────────────────────────

function groupByDate(items: AiHistoryItem[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const week = today - 7 * 86_400_000;

  const groups: Record<string, AiHistoryItem[]> = {
    Today: [],
    Yesterday: [],
    "Past 7 Days": [],
    Older: [],
  };

  for (const item of items) {
    const t = new Date(item.created_at).getTime();
    if (t >= today) groups["Today"].push(item);
    else if (t >= yesterday) groups["Yesterday"].push(item);
    else if (t >= week) groups["Past 7 Days"].push(item);
    else groups["Older"].push(item);
  }

  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarProps {
  items: AiHistoryItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (item: AiHistoryItem) => void;
  onNewChat: () => void;
  search: string;
  onSearch: (v: string) => void;
}

function ChatSidebar({ items, loading, selectedId, onSelect, onNewChat, search, onSearch }: SidebarProps) {
  const groups = useMemo(() => {
    const filtered = search
      ? items.filter((i) => i.question.toLowerCase().includes(search.toLowerCase()))
      : items;
    return groupByDate(filtered);
  }, [items, search]);

  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" });

  return (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-lg bg-sidebar-primary">
            <Sparkles className="size-3 text-sidebar-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-sidebar-foreground">AI Chat</span>
        </div>
        <button onClick={onNewChat} title="New chat"
          className="flex size-7 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
          <Plus className="size-4" />
        </button>
      </div>

      {/* New Chat button */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button onClick={onNewChat}
          className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-sidebar-border px-3 py-2.5 text-sm text-sidebar-foreground/60 hover:border-sidebar-primary/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all group">
          <Plus className="size-4 group-hover:text-primary transition-colors" />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <input value={search} onChange={(e) => onSearch(e.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-lg bg-sidebar-accent border-0 pl-7 pr-7 py-1.5 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 outline-none focus:ring-1 focus:ring-sidebar-primary/30" />
          {search && (
            <button onClick={() => onSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="size-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {loading && (
          <div className="space-y-1.5 px-1 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-sidebar-accent/50" />
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <MessageSquare className="size-8 text-sidebar-foreground/20" />
            <p className="text-xs text-sidebar-foreground/40">No chats yet</p>
          </div>
        )}

        {!loading && Object.entries(groups).map(([label, groupItems]) => {
          if (!groupItems.length) return null;
          return (
            <div key={label}>
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {label}
              </p>
              {groupItems.map((item) => (
                <button key={item.id} onClick={() => onSelect(item)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left transition-all group",
                    selectedId === item.id
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}>
                  <p className="truncate text-xs font-medium leading-snug">{item.question}</p>
                  <p className={cn("mt-0.5 text-[10px] truncate",
                    selectedId === item.id ? "text-sidebar-primary-foreground/60" : "text-sidebar-foreground/40")}>
                    {label === "Today"
                      ? fmt.format(new Date(item.created_at))
                      : fmtDate.format(new Date(item.created_at))}
                    {" · "}{item.result_count} row{item.result_count !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AiPage() {
  const [currentMsgs, setCurrentMsgs] = useState<ChatMsg[]>([]);
  const [selectedItem, setSelectedItem] = useState<AiHistoryItem | null>(null);
  const [question, setQuestion] = useState("");
  const [search, setSearch] = useState("");

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaEl  = textareaRef.current;

  const aiQuery = useAiQuery();
  const history = useAiHistory(100, 0);
  const historyItems = history.data?.items ?? [];

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMsgs, selectedItem]);

  function handleNewChat() {
    setSelectedItem(null);
    setCurrentMsgs([]);
    setQuestion("");
    textareaRef.current?.focus();
  }

  function handleSelect(item: AiHistoryItem) {
    setSelectedItem(item);
    setCurrentMsgs([]);
    setQuestion("");
  }

  const submit = useCallback(() => {
    const q = question.trim();
    if (!q || aiQuery.isPending || aiQuery.retryAfter > 0) return;

    // If viewing history, switch to new-chat mode first
    setSelectedItem(null);
    setQuestion("");

    // Reset textarea height
    if (textareaEl) { textareaEl.style.height = "auto"; }

    const tempId = `tmp-${Date.now()}`;
    setCurrentMsgs((prev) => [...prev, { id: tempId, question: q, status: "loading" }]);

    aiQuery.mutate(q, {
      onSuccess(data) {
        setCurrentMsgs((prev) =>
          prev.map((m) => m.id === tempId ? { ...m, id: data.id, status: "done", response: data } : m)
        );
      },
      onError(err: any) {
        const msg = err?.response?.data?.message ?? "AI query failed";
        setCurrentMsgs((prev) =>
          prev.map((m) => m.id === tempId ? { ...m, status: "error", error: msg } : m)
        );
      },
    });
  }, [question, aiQuery, textareaEl]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  function handleSuggestion(s: string) {
    setQuestion(s);
    setSelectedItem(null);
    textareaRef.current?.focus();
  }

  function resizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  // What's shown in the main area
  const mode: "empty" | "history" | "new" =
    selectedItem ? "history" : currentMsgs.length > 0 ? "new" : "empty";

  // Chat title
  const chatTitle =
    selectedItem ? selectedItem.question
    : currentMsgs[0]?.question ?? "New Chat";

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mb-6 overflow-hidden">

      {/* ── Sidebar ── */}
      <motion.aside
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 260, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="shrink-0 overflow-hidden"
      >
        <ChatSidebar
          items={historyItems}
          loading={history.isLoading}
          selectedId={selectedItem?.id ?? null}
          onSelect={handleSelect}
          onNewChat={handleNewChat}
          search={search}
          onSearch={setSearch}
        />
      </motion.aside>

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col min-w-0 bg-background">

        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-3 shrink-0 bg-background/80 backdrop-blur-sm">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold truncate flex-1 text-foreground">
            {chatTitle}
          </p>
          {aiQuery.retryAfter > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-600 dark:text-amber-400">
              <Clock className="size-3" /> Retry in {aiQuery.retryAfter}s
            </div>
          )}
          <button onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            <Plus className="size-3.5" /> New Chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-5 py-6 space-y-8">

            {/* Empty state */}
            {mode === "empty" && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-8 pt-12 pb-4">
                <div className="text-center space-y-2">
                  <motion.div animate={{ rotate: [0, -8, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                    <Sparkles className="size-8 text-primary" />
                  </motion.div>
                  <h2 className="text-xl font-semibold">What do you want to know?</h2>
                  <p className="text-sm text-muted-foreground">
                    Ask anything about your marketing data — I'll query the database and explain the results.
                  </p>
                </div>

                {/* Suggestion grid */}
                <div className="grid grid-cols-2 gap-2.5 w-full max-w-xl">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => handleSuggestion(s)}
                      className="rounded-xl border bg-muted/30 px-4 py-3 text-left text-sm text-foreground/80 hover:border-primary/40 hover:bg-muted/60 hover:text-foreground transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* History view */}
            {mode === "history" && selectedItem && (
              <AnimatePresence mode="wait">
                <motion.div key={selectedItem.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <HistoryView item={selectedItem} />
                </motion.div>
              </AnimatePresence>
            )}

            {/* Current session messages */}
            {mode === "new" && (
              <div className="space-y-8">
                {currentMsgs.map((msg, i) => (
                  <ChatBubble key={msg.id} msg={msg} isNew={i === currentMsgs.length - 1 && msg.status !== "done"} />
                ))}
              </div>
            )}

            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        {/* ── Input bar ── */}
        <div className="shrink-0 border-t bg-background/80 backdrop-blur-sm px-5 py-3">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-3 rounded-2xl border bg-background shadow-sm px-4 py-3 focus-within:ring-2 focus-within:ring-primary/20 transition-shadow">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => { setQuestion(e.target.value); resizeTextarea(e.target); }}
                onKeyDown={handleKey}
                placeholder="Ask about your marketing data…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed min-h-[24px] max-h-[140px]"
              />
              <button onClick={submit}
                disabled={!question.trim() || aiQuery.isPending || aiQuery.retryAfter > 0}
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl transition-all",
                  question.trim() && !aiQuery.isPending && aiQuery.retryAfter === 0
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}>
                {aiQuery.isPending
                  ? <RefreshCw className="size-4 animate-spin" />
                  : <Send className="size-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
