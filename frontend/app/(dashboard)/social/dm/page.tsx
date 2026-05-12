"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Camera, MessageCircle, User, Send } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { useConnectors } from "@/hooks/useConnectors";
import {
  useFacebookPages,
  useInstagramAccounts,
  useSendFacebookDM,
  useSendInstagramDM,
} from "@/hooks/useSocial";

type Platform = "facebook" | "instagram";

export default function SocialDMPage() {
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [connectorId, setConnectorId] = useState("");
  const [pageId, setPageId] = useState("");
  const [igId, setIgId] = useState("");
  const [pageToken, setPageToken] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");

  const { data: allConnectors = [] } = useConnectors();
  const fbConnectors = allConnectors.filter((c) => c.platform === "facebook_pages" && c.status === "connected");
  const igConnectors = allConnectors.filter((c) => c.platform === "instagram" && c.status === "connected");
  const activeConnectors = platform === "facebook" ? fbConnectors : igConnectors;

  const { data: fbPages = [], isLoading: pagesLoading } = useFacebookPages(
    platform === "facebook" ? connectorId : ""
  );
  const { data: igAccounts = [], isLoading: accountsLoading } = useInstagramAccounts(
    platform === "instagram" ? connectorId : ""
  );

  const sendFbDM = useSendFacebookDM();
  const sendIgDM = useSendInstagramDM();
  const isPending = sendFbDM.isPending || sendIgDM.isPending;

  function handleConnectorChange(id: string) {
    setConnectorId(id);
    setPageId("");
    setIgId("");
    setPageToken("");
  }

  function handleIgAccountChange(igid: string) {
    const account = igAccounts.find((a) => a.ig_id === igid);
    if (account) {
      setIgId(account.ig_id);
      setPageToken(account.page_token);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (platform === "facebook") {
      sendFbDM.mutate(
        { connector_id: connectorId, page_id: pageId, recipient_id: recipientId, message },
        { onSuccess: () => { setMessage(""); setRecipientId(""); } }
      );
    } else {
      sendIgDM.mutate(
        { connector_id: connectorId, ig_id: igId, page_token: pageToken, recipient_id: recipientId, message },
        { onSuccess: () => { setMessage(""); setRecipientId(""); } }
      );
    }
  }

  const canSubmit =
    !!connectorId &&
    !!recipientId &&
    !!message &&
    (platform === "facebook" ? !!pageId : !!igId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send Direct Message"
        subtitle="Send a DM via Facebook Messenger or Instagram Direct."
      />

      {/* Info banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
        <strong>Note:</strong> Recipients must have messaged your page or account first within the last 24 hours (Meta policy).
      </div>

      {/* Platform tabs */}
      <div className="flex gap-2">
        {(["facebook", "instagram"] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPlatform(p); setConnectorId(""); setPageId(""); setIgId(""); setPageToken(""); }}
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

      <motion.div
        key={platform}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-2xl border bg-card p-6 shadow-sm"
      >
        {activeConnectors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <MessageCircle className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No connected {platform === "facebook" ? "Facebook Pages" : "Instagram"} connector found.
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/connectors"}>
              Go to Connectors
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Connector */}
            <Field>
              <FieldLabel>Account</FieldLabel>
              <select
                value={connectorId}
                onChange={(e) => handleConnectorChange(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select connector…</option>
                {activeConnectors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            {/* Page selector (FB) */}
            {connectorId && platform === "facebook" && (
              <Field>
                <FieldLabel>Facebook Page</FieldLabel>
                {pagesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading pages…</p>
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
            )}

            {/* IG account selector */}
            {connectorId && platform === "instagram" && (
              <Field>
                <FieldLabel>Instagram Account</FieldLabel>
                {accountsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading accounts…</p>
                ) : (
                  <select
                    value={igId}
                    onChange={(e) => handleIgAccountChange(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select account…</option>
                    {igAccounts.map((a) => (
                      <option key={a.ig_id} value={a.ig_id}>
                        @{a.ig_username || a.ig_name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}

            {/* Recipient */}
            <Field>
              <FieldLabel className="flex items-center gap-1.5">
                <User className="size-3.5" />
                Recipient User ID
              </FieldLabel>
              <Input
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="Facebook/Instagram user ID"
              />
              <p className="text-xs text-muted-foreground">
                The Page-scoped user ID of the recipient who messaged you.
              </p>
            </Field>

            {/* Message */}
            <Field>
              <FieldLabel className="flex items-center gap-1.5">
                <MessageCircle className="size-3.5" />
                Message
              </FieldLabel>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your message…"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </Field>

            <Button type="submit" disabled={!canSubmit || isPending} className="w-full">
              <Send className="mr-2 size-4" />
              {isPending ? "Sending…" : `Send via ${platform === "facebook" ? "Messenger" : "Instagram Direct"}`}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
