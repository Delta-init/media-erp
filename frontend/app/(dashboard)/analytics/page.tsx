"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Heart, MessageCircle, Users, TrendingUp,
  ExternalLink, X, Send, ChevronRight, BarChart3,
  ImageIcon, Video, Grid3x3, RefreshCw, Loader2,
} from "lucide-react";
import { useConnectors } from "@/hooks/useConnectors";
import {
  useInstagramLoginAccount,
  useInstagramLoginPosts,
  useInstagramLoginPostComments,
  useReplyToInstagramComment,
  type IGPost,
  type IGComment,
} from "@/hooks/useSocial";
import type { Connector } from "@/types/connector";
import PageHeader from "@/components/shared/PageHeader";

// ── helpers ───────────────────────────────────────────────────────────────────

const igGradient = "linear-gradient(135deg, #E1306C, #833AB4, #405DE6)";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function formatCount(n: number | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function engagement(post: IGPost, followers: number | undefined) {
  if (!followers || followers === 0) return null;
  const rate = ((post.like_count ?? 0) + (post.comments_count ?? 0)) / followers * 100;
  return rate.toFixed(2) + "%";
}

function MediaIcon({ type }: { type: IGPost["media_type"] }) {
  if (type === "VIDEO") return <Video className="size-3 text-white" />;
  if (type === "CAROUSEL_ALBUM") return <Grid3x3 className="size-3 text-white" />;
  return <ImageIcon className="size-3 text-white" />;
}

// ── Comment panel ─────────────────────────────────────────────────────────────

function CommentPanel({
  connectorId,
  post,
  onClose,
}: {
  connectorId: string;
  post: IGPost;
  onClose: () => void;
}) {
  const { data: comments = [], isLoading } = useInstagramLoginPostComments(connectorId, post.id);
  const reply = useReplyToInstagramComment();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  function handleReply(commentId: string) {
    if (!replyText.trim()) return;
    reply.mutate(
      { connectorId, postId: post.id, commentId, message: replyText.trim() },
      { onSuccess: () => { setReplyText(""); setReplyingTo(null); } }
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <div className="size-10 rounded-lg overflow-hidden bg-muted shrink-0">
          {post.media_url
            ? <img src={post.media_url} alt="" className="size-full object-cover" />
            : <div className="size-full flex items-center justify-center"><Camera className="size-4 text-muted-foreground" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{post.caption || "No caption"}</p>
          <p className="text-xs text-muted-foreground">{fmtDate(post.timestamp)}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1"><Heart className="size-3 text-rose-400" />{formatCount(post.like_count)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="size-3 text-blue-400" />{formatCount(post.comments_count)}</span>
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <X className="size-4" />
        </button>
      </div>

      {/* Comments */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-10 gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading comments…
          </div>
        )}
        {!isLoading && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <MessageCircle className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No comments yet</p>
          </div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="space-y-2">
            {/* Comment */}
            <div className="flex gap-2.5">
              <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                {(c.username ?? "?").slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="rounded-xl rounded-tl-sm bg-muted/50 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">@{c.username ?? "user"}</p>
                  <p className="text-sm mt-0.5">{c.text}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 px-1">
                  <span className="text-[10px] text-muted-foreground">{fmtDate(c.timestamp)}</span>
                  {c.like_count != null && c.like_count > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Heart className="size-2.5" /> {c.like_count}
                    </span>
                  )}
                  <button
                    onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                    className="text-[10px] font-medium text-primary hover:underline"
                  >
                    Reply
                  </button>
                </div>

                {/* Replies */}
                {c.replies?.data?.map((r) => (
                  <div key={r.id} className="flex gap-2 mt-2 ml-4">
                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[9px] font-bold uppercase text-primary">
                      {(r.username ?? "?").slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="rounded-xl rounded-tl-sm bg-primary/5 px-2.5 py-1.5">
                        <p className="text-[10px] font-semibold text-primary">@{r.username ?? "you"}</p>
                        <p className="text-xs mt-0.5">{r.text}</p>
                      </div>
                      <span className="text-[9px] text-muted-foreground px-1">{fmtDate(r.timestamp)}</span>
                    </div>
                  </div>
                ))}

                {/* Reply input */}
                {replyingTo === c.id && (
                  <div className="flex items-center gap-2 mt-2 ml-4">
                    <input
                      autoFocus
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReply(c.id)}
                      placeholder="Write a reply…"
                      className="flex-1 rounded-xl border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                    <button
                      onClick={() => handleReply(c.id)}
                      disabled={!replyText.trim() || reply.isPending}
                      className="rounded-xl bg-primary p-1.5 text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      {reply.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Post row ──────────────────────────────────────────────────────────────────

function PostRow({
  post,
  followers,
  isSelected,
  onSelect,
}: {
  post: IGPost;
  followers: number | undefined;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const eng = engagement(post, followers);
  const thumb = post.thumbnail_url ?? post.media_url;

  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-b transition-colors hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
    >
      <td className="py-3 pl-4 pr-2">
        <div className="relative size-10 rounded-lg overflow-hidden bg-muted shrink-0">
          {thumb
            ? <img src={thumb} alt="" className="size-full object-cover" />
            : <div className="size-full flex items-center justify-center bg-gradient-to-br from-pink-500/20 to-purple-500/20"><Camera className="size-4 text-muted-foreground" /></div>
          }
          <div className="absolute bottom-0.5 right-0.5 rounded-sm p-0.5" style={{ background: igGradient }}>
            <MediaIcon type={post.media_type} />
          </div>
        </div>
      </td>
      <td className="py-3 px-2 max-w-[220px]">
        {post.caption
          ? <p className="text-sm truncate">{post.caption}</p>
          : <p className="text-sm text-muted-foreground italic">No caption</p>
        }
        {post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary mt-0.5"
          >
            <ExternalLink className="size-2.5" /> View on Instagram
          </a>
        )}
      </td>
      <td className="py-3 px-2 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(post.timestamp)}</td>
      <td className="py-3 px-2">
        <span className="flex items-center gap-1 text-sm">
          <Heart className="size-3.5 text-rose-400" />
          {formatCount(post.like_count)}
        </span>
      </td>
      <td className="py-3 px-2">
        <span className="flex items-center gap-1 text-sm">
          <MessageCircle className="size-3.5 text-blue-400" />
          {formatCount(post.comments_count)}
        </span>
      </td>
      <td className="py-3 pl-2 pr-4">
        {eng != null
          ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{eng}</span>
          : <span className="text-xs text-muted-foreground">—</span>
        }
      </td>
      <td className="py-3 pr-4">
        <ChevronRight className={`size-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90 text-primary" : ""}`} />
      </td>
    </tr>
  );
}

// ── Account header card ───────────────────────────────────────────────────────

function AccountHeader({ connectorId }: { connectorId: string }) {
  const { data: account, isLoading } = useInstagramLoginAccount(connectorId);

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-5 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }
  if (!account) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <div className="h-16 relative" style={{ background: igGradient }} />
      <div className="px-5 pb-5">
        <div className="flex items-end gap-4 -mt-8 mb-4">
          <div className="size-16 rounded-2xl border-4 border-card overflow-hidden bg-muted shadow-md shrink-0">
            {account.profile_picture_url
              ? <img src={account.profile_picture_url} alt="" className="size-full object-cover" />
              : <div className="size-full flex items-center justify-center" style={{ background: igGradient }}>
                  <Camera className="size-7 text-white" />
                </div>
            }
          </div>
          <div className="pb-1">
            <p className="font-bold text-base leading-tight">{account.name ?? account.username}</p>
            {account.username && <p className="text-sm text-muted-foreground">@{account.username}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-muted/30 p-3 text-center">
            <Users className="size-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold leading-none">{formatCount(account.followers_count)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Followers</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3 text-center">
            <ImageIcon className="size-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold leading-none">{formatCount(account.media_count)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Posts</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3 text-center">
            <TrendingUp className="size-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-xl font-bold leading-none">
              {account.followers_count && account.media_count
                ? (account.followers_count / Math.max(account.media_count, 1)).toFixed(0)
                : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Followers/Post</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: allConnectors = [] } = useConnectors();
  const igConnectors = allConnectors.filter((c: Connector) => c.platform === "instagram_login");

  const [connectorId, setConnectorId] = useState<string>("");
  const activeConnectorId = connectorId || igConnectors[0]?.id || "";

  const { data: posts = [], isLoading: postsLoading } = useInstagramLoginPosts(activeConnectorId);
  const { data: account } = useInstagramLoginAccount(activeConnectorId);
  const [selectedPost, setSelectedPost] = useState<IGPost | null>(null);

  const noConnectors = igConnectors.length === 0;
  const activeConnector = igConnectors.find((c: Connector) => c.id === activeConnectorId);
  const isDisconnected = activeConnector && activeConnector.status !== "connected";

  return (
    <div className="space-y-5 h-full">
      <PageHeader
        title="Analytics"
        subtitle="Instagram account performance and post engagement"
      />

      {/* Connector selector */}
      {igConnectors.length > 1 && (
        <div className="flex items-center gap-2">
          <Camera className="size-4 text-muted-foreground shrink-0" />
          <select
            value={activeConnectorId}
            onChange={(e) => { setConnectorId(e.target.value); setSelectedPost(null); }}
            className="rounded-xl border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            {igConnectors.map((c: Connector) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* No connector state */}
      {noConnectors && (
        <div className="flex flex-col items-center justify-center py-24 gap-5 rounded-2xl border bg-card">
          <div className="size-20 rounded-2xl flex items-center justify-center shadow-md" style={{ background: igGradient }}>
            <Camera className="size-10 text-white" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg">No Instagram account connected</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Connect your Instagram account in Connectors to see analytics, posts, and engagement data.
            </p>
          </div>
          <a
            href="/connectors"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Go to Connectors
          </a>
        </div>
      )}

      {/* Disconnected state */}
      {!noConnectors && isDisconnected && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-2xl border border-dashed bg-card">
          <div className="size-14 rounded-2xl flex items-center justify-center opacity-60" style={{ background: igGradient }}>
            <Camera className="size-7 text-white" />
          </div>
          <div className="text-center">
            <p className="font-medium">{activeConnector?.name} is disconnected</p>
            <p className="text-sm text-muted-foreground mt-1">Reconnect this account in Connectors to view analytics.</p>
          </div>
          <a href="/connectors" className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            Reconnect
          </a>
        </div>
      )}

      {/* Main content — connected */}
      {!noConnectors && !isDisconnected && (
        <div className={`grid gap-5 transition-all ${selectedPost ? "lg:grid-cols-[1fr_420px]" : "grid-cols-1"}`}>
          {/* Left: account + table */}
          <div className="space-y-5 min-w-0">
            {/* Account header */}
            <AccountHeader connectorId={activeConnectorId} />

            {/* Post engagement table */}
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b">
                <BarChart3 className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">Post-level Engagement</p>
                  <p className="text-xs text-muted-foreground">Individual post performance</p>
                </div>
                {postsLoading && <RefreshCw className="size-3.5 animate-spin text-muted-foreground ml-auto" />}
                {!postsLoading && (
                  <span className="ml-auto text-xs text-muted-foreground">{posts.length} posts</span>
                )}
              </div>

              {postsLoading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading posts…
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <ImageIcon className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No posts found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="py-2.5 pl-4 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Thumb</th>
                        <th className="py-2.5 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Caption</th>
                        <th className="py-2.5 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                        <th className="py-2.5 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Likes</th>
                        <th className="py-2.5 px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comments</th>
                        <th className="py-2.5 pl-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Engagement</th>
                        <th className="py-2.5 pr-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map((post) => (
                        <PostRow
                          key={post.id}
                          post={post}
                          followers={account?.followers_count}
                          isSelected={selectedPost?.id === post.id}
                          onSelect={() => setSelectedPost(selectedPost?.id === post.id ? null : post)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right: comment panel */}
          <AnimatePresence>
            {selectedPost && (
              <motion.div
                key={selectedPost.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="rounded-2xl border bg-card shadow-sm overflow-hidden flex flex-col"
                style={{ maxHeight: "80vh", position: "sticky", top: "1rem" }}
              >
                <div className="px-4 py-3 border-b shrink-0" style={{ background: igGradient }}>
                  <p className="text-xs font-semibold text-white/90 uppercase tracking-wider">Comments</p>
                </div>
                <CommentPanel
                  connectorId={activeConnectorId}
                  post={selectedPost}
                  onClose={() => setSelectedPost(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
