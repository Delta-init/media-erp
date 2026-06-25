"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Users,
  Activity,
  Camera,
  ChevronDown,
  ImageIcon,
  Heart,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Send,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/shared/PageHeader";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { useConnectors } from "@/hooks/useConnectors";
import {
  useInstagramLoginAccount,
  useInstagramLoginPosts,
  useInstagramLoginInsights,
  useInstagramLoginPostComments,
  useReplyToInstagramComment,
  type IGInsightDay,
  type IGComment,
} from "@/hooks/useSocial";
import { kpiContainerVariants, kpiCardVariants } from "@/lib/animations";

// ── Helpers ───────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n + 1);
  return d.toISOString().slice(0, 10);
}
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number | null;
  delta?: number | null;
  icon: LucideIcon;
  color: string;
  bg: string;
  loading?: boolean;
  formatter?: (v: number) => string;
}

function KpiCard({ label, value, delta, icon: Icon, color, bg, loading, formatter = fmt }: KpiCardProps) {
  const isUp   = delta != null && delta > 0;
  const isDown = delta != null && delta < 0;

  return (
    <motion.div
      variants={kpiCardVariants}
      whileHover={{ y: -3, boxShadow: "0 12px 32px -8px rgb(0 0 0 / 0.14)" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={cn("flex size-8 items-center justify-center rounded-lg", bg)}>
          <Icon className={cn("size-4", color)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold tracking-tight">
            {value !== null && value !== undefined ? formatter(value) : "—"}
          </p>
          {delta !== null && delta !== undefined ? (
            <p className={cn(
              "mt-1 flex items-center gap-1 text-xs font-medium",
              isUp ? "text-emerald-500" : isDown ? "text-destructive" : "text-muted-foreground",
            )}>
              {isUp   && <TrendingUp   className="size-3" />}
              {isDown && <TrendingDown className="size-3" />}
              {!isUp && !isDown && <Minus className="size-3" />}
              {`${isUp ? "+" : ""}${delta.toFixed(1)}% vs prev period`}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Last 30 days</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Trend chart tooltip ────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ── Comments panel for a single post ─────────────────────────────────────────
function CommentsPanel({ connectorId, postId }: { connectorId: string; postId: string }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText,  setReplyText ] = useState("");

  const { data: comments, isLoading } = useInstagramLoginPostComments(connectorId, postId);
  const reply = useReplyToInstagramComment(connectorId, postId);

  function submitReply(commentId: string) {
    if (!replyText.trim()) return;
    reply.mutate(
      { commentId, message: replyText.trim() },
      { onSuccess: () => { setReplyingTo(null); setReplyText(""); } },
    );
  }

  if (isLoading) {
    return (
      <div className="px-5 py-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="size-7 rounded-full animate-pulse bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!comments?.length) {
    return (
      <div className="px-5 py-4 text-xs text-muted-foreground">
        No comments on this post yet.
      </div>
    );
  }

  return (
    <div className="divide-y border-t bg-muted/30">
      {comments.map((c: IGComment) => (
        <div key={c.id} className="px-5 py-3 space-y-1.5">
          {/* Comment row */}
          <div className="flex items-start gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-[10px] font-bold text-white">
              {(c.username ?? "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight">@{c.username ?? "unknown"}</p>
              <p className="text-sm leading-snug mt-0.5">{c.text}</p>
              {c.timestamp && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(c.timestamp).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setReplyingTo(replyingTo === c.id ? null : c.id);
                setReplyText("");
              }}
              className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle className="size-3" />
              Reply
            </button>
          </div>

          {/* Existing replies */}
          {c.replies?.data?.length ? (
            <div className="ml-9 space-y-1.5 border-l-2 border-muted pl-3">
              {c.replies.data.map((r) => (
                <div key={r.id} className="flex items-start gap-2">
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                    {(r.username ?? "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold">@{r.username ?? "you"}</p>
                    <p className="text-xs">{r.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Reply input */}
          <AnimatePresence>
            {replyingTo === c.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="ml-9 overflow-hidden"
              >
                <div className="flex gap-2 pt-1">
                  <input
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitReply(c.id); }}}
                    placeholder={`Reply to @${c.username ?? "user"}…`}
                    className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    onClick={() => submitReply(c.id)}
                    disabled={!replyText.trim() || reply.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    <Send className="size-3" />
                    {reply.isPending ? "Sending…" : "Send"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo,   setDateTo  ] = useState(today());
  const [connectorId, setConnectorId] = useState("");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  // All connectors → filter to instagram_login
  const { data: connectors, isLoading: loadingConnectors } = useConnectors();
  const igConnectors = useMemo(
    () => (connectors ?? []).filter((c) => c.platform === "instagram_login" && c.status === "connected"),
    [connectors],
  );

  // Auto-select first connector
  const activeId = connectorId || igConnectors[0]?.id || "";

  const { data: account,  isLoading: loadingAccount  } = useInstagramLoginAccount(activeId);
  const { data: posts,    isLoading: loadingPosts     } = useInstagramLoginPosts(activeId);
  const { data: insights, isLoading: loadingInsights,
          refetch: refetchInsights, isFetching } = useInstagramLoginInsights(activeId, dateFrom, dateTo);

  // Build chart data
  const chartData = useMemo(() => {
    if (!insights?.daily) return [];
    return insights.daily.map((d: IGInsightDay) => ({
      date:          fmtDate(d.date),
      Impressions:   d.impressions,
      Reach:         d.reach,
      "Profile Views": d.profile_views,
    }));
  }, [insights]);

  // Post engagement helper
  function engagementRate(likes: number, comments: number, followers: number) {
    if (!followers) return "—";
    return `${(((likes + comments) / followers) * 100).toFixed(2)}%`;
  }

  const noConnector = !loadingConnectors && igConnectors.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="Camera Analytics"
        subtitle="Account insights powered by instagram_business_manage_insights"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Account selector */}
            {igConnectors.length > 1 && (
              <select
                value={activeId}
                onChange={(e) => setConnectorId(e.target.value)}
                className="h-9 rounded-lg border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {igConnectors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <DateRangePicker
              dateFrom={dateFrom}
              dateTo={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
            />
            <button
              onClick={() => refetchInsights()}
              disabled={isFetching}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-card text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
              Refresh
            </button>
          </div>
        }
      />

      {/* No connector state */}
      {noConnector && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-12 text-center"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-pink-500/10">
            <Camera className="size-6 text-pink-500" />
          </div>
          <p className="font-medium">No Camera account connected</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Connect an Instagram Business account via the Connectors page to view analytics.
          </p>
          <a
            href="/connectors"
            className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Go to Connectors
          </a>
        </motion.div>
      )}

      {!noConnector && (
        <>
          {/* Account banner */}
          {(account || loadingAccount) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                <Camera className="size-4 text-white" />
              </div>
              {loadingAccount ? (
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              ) : (
                <div>
                  <p className="text-sm font-semibold">@{account?.username ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{account?.name}</p>
                </div>
              )}
              {!loadingAccount && account && (
                <div className="ml-auto flex gap-6 text-sm">
                  <div className="text-center">
                    <p className="font-bold">{fmt(account.followers_count ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{account.media_count ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Posts</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* KPI Cards */}
          <motion.div
            variants={kpiContainerVariants}
            initial="initial"
            animate="animate"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
          >
            <KpiCard
              label="Impressions"
              value={insights?.totals?.impressions ?? null}
              icon={Eye}
              color="text-blue-500"
              bg="bg-blue-500/10"
              loading={loadingInsights}
            />
            <KpiCard
              label="Reach"
              value={insights?.totals?.reach ?? null}
              icon={Activity}
              color="text-violet-500"
              bg="bg-violet-500/10"
              loading={loadingInsights}
            />
            <KpiCard
              label="Profile Views"
              value={insights?.totals?.profile_views ?? null}
              icon={Users}
              color="text-pink-500"
              bg="bg-pink-500/10"
              loading={loadingInsights}
            />
          </motion.div>

          {/* Trend Chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Impressions &amp; Reach Over Time</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Daily account-level metrics</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-sm bg-blue-500" />
                  Impressions
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-sm bg-violet-500" />
                  Reach
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-sm bg-pink-500" />
                  Profile Views
                </span>
              </div>
            </div>

            {loadingInsights ? (
              <div className="h-52 animate-pulse rounded-lg bg-muted" />
            ) : chartData.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                No data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradImp"  x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradPV"   x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ec4899" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} className="text-muted-foreground" interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="Impressions"   stroke="#3b82f6" strokeWidth={2} fill="url(#gradImp)"   dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Reach"         stroke="#8b5cf6" strokeWidth={2} fill="url(#gradReach)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="Profile Views" stroke="#ec4899" strokeWidth={2} fill="url(#gradPV)"    dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Post-level Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.18 }}
            className="rounded-xl border bg-card shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="text-sm font-semibold">Post-level Engagement</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Individual post performance</p>
              </div>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>

            {loadingPosts ? (
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="size-12 rounded-lg animate-pulse bg-muted shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : !posts?.length ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <ImageIcon className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No posts found</p>
              </div>
            ) : (
              <div className="divide-y">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-2 text-xs font-medium text-muted-foreground">
                  <span className="w-12" />
                  <span>Caption</span>
                  <span className="w-20 text-right">Date</span>
                  <span className="w-16 text-right">Likes</span>
                  <span className="w-20 text-right">Comments</span>
                  <span className="w-24 text-right">Engagement</span>
                </div>
                {posts.map((post) => {
                  const likes    = post.like_count    ?? 0;
                  const comments = post.comments_count ?? 0;
                  const followers = account?.followers_count ?? 0;
                  const eng = engagementRate(likes, comments, followers);
                  const dateStr = post.timestamp
                    ? new Date(post.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })
                    : "—";
                  const isExpanded = expandedPost === post.id;

                  return (
                    <div key={post.id}>
                      {/* Post row */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                        className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 items-center px-5 py-3 hover:bg-muted/40 transition-colors group cursor-pointer"
                      >
                        {/* Thumbnail */}
                        <div className="size-12 rounded-lg overflow-hidden bg-muted shrink-0">
                          {post.media_url || post.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.thumbnail_url ?? post.media_url ?? ""}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="size-5 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>

                        {/* Caption + link */}
                        <div className="min-w-0">
                          <p className="text-sm truncate leading-tight">
                            {post.caption ?? <span className="text-muted-foreground italic">No caption</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 md:hidden">{dateStr}</p>
                          {post.permalink && (
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                            >
                              View on Instagram <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>

                        {/* Date */}
                        <span className="hidden md:block text-xs text-muted-foreground text-right w-20">{dateStr}</span>

                        {/* Likes */}
                        <div className="hidden md:flex items-center gap-1 justify-end w-16">
                          <Heart className="size-3 text-rose-400" />
                          <span className="text-sm font-medium">{fmt(likes)}</span>
                        </div>

                        {/* Comments — clickable hint */}
                        <div className="hidden md:flex items-center gap-1 justify-end w-20">
                          <MessageCircle className="size-3 text-blue-400" />
                          <span className="text-sm font-medium">{fmt(comments)}</span>
                        </div>

                        {/* Engagement rate */}
                        <div className="hidden md:block w-24 text-right">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            parseFloat(eng) >= 3
                              ? "bg-emerald-500/10 text-emerald-600"
                              : parseFloat(eng) >= 1
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-muted text-muted-foreground",
                          )}>
                            {eng}
                          </span>
                        </div>

                        {/* Expand chevron */}
                        <ChevronDown className={cn(
                          "hidden md:block size-4 text-muted-foreground transition-transform duration-200",
                          isExpanded && "rotate-180",
                        )} />
                      </motion.div>

                      {/* Comments panel */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <CommentsPanel connectorId={activeId} postId={post.id} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
