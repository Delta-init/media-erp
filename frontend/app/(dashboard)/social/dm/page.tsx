"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2, Camera, MessageCircle, Send, RefreshCw,
  User, ChevronRight, Inbox,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { useConnectors } from "@/hooks/useConnectors";
import {
  useFacebookPages,
  useFacebookConversations,
  useFacebookMessages,
  useInstagramLoginConversations,
  useInstagramLoginMessages,
  useSendFacebookDM,
  useSendInstagramLoginDM,
  type Conversation,
  type FacebookPage,
} from "@/hooks/useSocial";

type Platform = "facebook" | "instagram";

// ── Helper ────────────────────────────────────────────────────────────────────

function getOtherParticipant(conv: Conversation, selfId: string) {
  return conv.participants?.data?.find((p) => p.id !== selfId) ?? conv.participants?.data?.[0];
}

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return "";
  }
}

// ── Conversation list item ────────────────────────────────────────────────────

function ConvItem({
  conv,
  selfId,
  selected,
  onClick,
}: {
  conv: Conversation;
  selfId: string;
  selected: boolean;
  onClick: () => void;
}) {
  const other = getOtherParticipant(conv, selfId);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b transition-colors ${
        selected
          ? "bg-primary/10 border-l-2 border-l-primary"
          : "hover:bg-muted/50 border-l-2 border-l-transparent"
      }`}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <User className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-sm font-medium">{other?.name ?? "Unknown"}</p>
          {(conv.unread_count ?? 0) > 0 && (
            <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {conv.unread_count}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{conv.snippet || "—"}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/60">{timeAgo(conv.updated_time)}</p>
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 mt-1" />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SocialDMPage() {
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [connectorId, setConnectorId] = useState("");
  const [pageId, setPageId] = useState("");
  const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);
  const [selectedConvId, setSelectedConvId] = useState("");
  const [reply, setReply] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: allConnectors = [] } = useConnectors();
  const fbConnectors = allConnectors.filter(
    (c) => c.platform === "facebook_pages" && c.status === "connected"
  );
  const igConnectors = allConnectors.filter(
    (c) => c.platform === "instagram_login" && c.status === "connected"
  );
  const activeConnectors = platform === "facebook" ? fbConnectors : igConnectors;

  // ── Facebook data ──────────────────────────────────────────────────────────
  const { data: fbPages = [], isLoading: pagesLoading } = useFacebookPages(
    platform === "facebook" ? connectorId : ""
  );
  const {
    data: fbConversations = [],
    isLoading: fbConvLoading,
    refetch: refetchFbConvs,
  } = useFacebookConversations(connectorId, pageId);

  const selectedFbConv = fbConversations.find((c) => c.id === selectedConvId) ?? null;

  const {
    data: fbMessages = [],
    isLoading: fbMsgLoading,
    refetch: refetchFbMsgs,
  } = useFacebookMessages(connectorId, pageId, selectedConvId);

  // ── Instagram Login data ───────────────────────────────────────────────────
  const {
    data: igConversations = [],
    isLoading: igConvLoading,
    refetch: refetchIgConvs,
  } = useInstagramLoginConversations(platform === "instagram" ? connectorId : "");

  const igConnector = allConnectors.find((c) => c.id === connectorId);
  const igSelfId = igConnector?.platform_account_id ?? "";

  const selectedIgConv = igConversations.find((c) => c.id === selectedConvId) ?? null;

  const {
    data: igMessages = [],
    isLoading: igMsgLoading,
    refetch: refetchIgMsgs,
  } = useInstagramLoginMessages(
    platform === "instagram" ? connectorId : "",
    selectedConvId
  );

  // ── Unified state ──────────────────────────────────────────────────────────
  const conversations = platform === "facebook" ? fbConversations : igConversations;
  const convLoading = platform === "facebook" ? fbConvLoading : igConvLoading;
  const messages = platform === "facebook" ? fbMessages : igMessages;
  const msgLoading = platform === "facebook" ? fbMsgLoading : igMsgLoading;
  const selectedConv = platform === "facebook" ? selectedFbConv : selectedIgConv;
  const selfId = platform === "facebook" ? pageId : igSelfId;

  function refetchAll() {
    if (platform === "facebook") { refetchFbConvs(); refetchFbMsgs(); }
    else { refetchIgConvs(); refetchIgMsgs(); }
  }

  // ── Send reply ─────────────────────────────────────────────────────────────
  const sendFbDM = useSendFacebookDM();
  const sendIgDM = useSendInstagramLoginDM();
  const isPending = sendFbDM.isPending || sendIgDM.isPending;

  function getRecipientId() {
    if (!selectedConv) return "";
    return getOtherParticipant(selectedConv, selfId)?.id ?? "";
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !selectedConvId) return;
    const recipientId = getRecipientId();
    if (!recipientId) return;

    if (platform === "facebook") {
      sendFbDM.mutate(
        { connector_id: connectorId, page_id: pageId, recipient_id: recipientId, message: reply },
        { onSuccess: () => { setReply(""); setTimeout(refetchAll, 1000); } }
      );
    } else {
      sendIgDM.mutate(
        { connector_id: connectorId, recipient_id: recipientId, message: reply },
        { onSuccess: () => { setReply(""); setTimeout(refetchAll, 1000); } }
      );
    }
  }

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset conversation when platform/connector/page changes
  useEffect(() => {
    setSelectedConvId("");
    setReply("");
  }, [platform, connectorId, pageId]);

  // Auto-select page token when page changes
  useEffect(() => {
    const p = fbPages.find((p) => p.id === pageId) ?? null;
    setSelectedPage(p);
  }, [pageId, fbPages]);

  return (
    <div className="flex h-full flex-col space-y-4">
      <PageHeader
        title="Messages"
        subtitle="View and reply to conversations on Facebook Messenger and Instagram Direct."
      />

      {/* Platform tabs */}
      <div className="flex gap-2">
        {(["facebook", "instagram"] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              setPlatform(p);
              setConnectorId("");
              setPageId("");
              setSelectedConvId("");
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              platform === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p === "facebook" ? <Share2 className="size-4" /> : <Camera className="size-4" />}
            {p === "facebook" ? "Messenger" : "Instagram Direct"}
          </button>
        ))}
      </div>

      {/* Selectors row */}
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[200px] flex-1">
          <Field>
            <FieldLabel>Connector</FieldLabel>
            <select
              value={connectorId}
              onChange={(e) => { setConnectorId(e.target.value); setPageId(""); }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select connector…</option>
              {activeConnectors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {platform === "facebook" && connectorId && (
          <div className="min-w-[200px] flex-1">
            <Field>
              <FieldLabel>Facebook Page</FieldLabel>
              {pagesLoading ? (
                <p className="text-sm text-muted-foreground py-2">Loading pages…</p>
              ) : (
                <select
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select page…</option>
                  {fbPages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        )}
      </div>

      {/* Inbox area */}
      {(!connectorId || (platform === "facebook" && !pageId)) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border bg-card py-20 text-center">
          <Inbox className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {activeConnectors.length === 0
              ? `No connected ${platform === "facebook" ? "Facebook Pages" : "Instagram"} connector.`
              : platform === "facebook" && !pageId
              ? "Select a Facebook Page to view conversations."
              : "Select a connector to view conversations."}
          </p>
          {activeConnectors.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/connectors")}>
              Go to Connectors
            </Button>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-sm" style={{ height: "calc(100vh - 340px)", minHeight: 440 }}>
          {/* Left: conversation list */}
          <div className="flex w-72 shrink-0 flex-col border-r">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">
                Conversations
                {conversations.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ({conversations.length})
                  </span>
                )}
              </span>
              <button
                onClick={refetchAll}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
                title="Refresh"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {convLoading ? (
                <div className="flex flex-col gap-2 p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
                  <MessageCircle className="size-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No conversations yet.</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Conversations appear once someone messages your page.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <ConvItem
                    key={conv.id}
                    conv={conv}
                    selfId={selfId}
                    selected={conv.id === selectedConvId}
                    onClick={() => setSelectedConvId(conv.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: message thread */}
          <div className="flex flex-1 flex-col min-w-0">
            {!selectedConvId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center px-6">
                <MessageCircle className="size-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">Select a conversation to view messages</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                {selectedConv && (
                  <div className="flex items-center gap-3 border-b px-5 py-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                      <User className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {getOtherParticipant(selectedConv, selfId)?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last active {timeAgo(selectedConv.updated_time)}
                      </p>
                    </div>
                    <button
                      onClick={() => { refetchFbMsgs(); refetchIgMsgs(); }}
                      className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                      title="Refresh messages"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {msgLoading ? (
                    <div className="flex flex-col gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-10 w-48 rounded-2xl bg-muted animate-pulse ${i % 2 === 0 ? "ml-auto" : ""}`}
                        />
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground">No messages in this conversation.</p>
                  ) : (
                    <AnimatePresence initial={false}>
                      {messages.map((msg) => {
                        const isFromSelf = msg.from?.id === selfId || msg.from?.id === pageId;
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`flex ${isFromSelf ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`flex flex-col max-w-[70%] gap-0.5 ${isFromSelf ? "items-end" : "items-start"}`}>
                              <div
                                className={`rounded-2xl px-4 py-2 text-sm ${
                                  isFromSelf
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-muted text-foreground rounded-bl-sm"
                                }`}
                              >
                                {msg.message}
                              </div>
                              <span className="text-[10px] text-muted-foreground/60 px-1">
                                {timeAgo(msg.created_time)}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply box */}
                <form onSubmit={handleSend} className="border-t px-4 py-3 flex gap-2 items-end">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e as unknown as React.FormEvent);
                      }
                    }}
                    rows={2}
                    placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                    className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!reply.trim() || isPending}
                    className="shrink-0 h-10"
                  >
                    <Send className="size-4" />
                  </Button>
                </form>

                {/* Meta policy note */}
                <p className="px-4 pb-2 text-[11px] text-muted-foreground/50 text-center">
                  Meta policy: you can only reply within 24 hours of the user&apos;s last message.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
