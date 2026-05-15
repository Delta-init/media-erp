"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Share2, Camera, ImageIcon, Link2, FileText, Send, User } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { useConnectors } from "@/hooks/useConnectors";
import {
  useFacebookPages,
  useInstagramLoginAccount,
  usePublishFacebookPost,
  usePublishInstagramLoginPost,
} from "@/hooks/useSocial";

type Platform = "facebook" | "instagram";

export default function SocialPostPage() {
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [connectorId, setConnectorId] = useState("");
  const [pageId, setPageId] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");

  const { data: allConnectors = [] } = useConnectors();
  const fbConnectors = allConnectors.filter((c) => c.platform === "facebook_pages" && c.status === "connected");
  // Instagram Login connector (direct OAuth — no Facebook Page required)
  const igConnectors = allConnectors.filter((c) => c.platform === "instagram_login" && c.status === "connected");

  const activeConnectors = platform === "facebook" ? fbConnectors : igConnectors;

  const { data: fbPages = [], isLoading: pagesLoading } = useFacebookPages(
    platform === "facebook" ? connectorId : ""
  );

  // For Instagram Login, we fetch the single account linked to the connector
  const { data: igAccount, isLoading: igLoading } = useInstagramLoginAccount(
    platform === "instagram" ? connectorId : ""
  );

  const publishFb = usePublishFacebookPost();
  const publishIg = usePublishInstagramLoginPost();

  const isPending = publishFb.isPending || publishIg.isPending;

  function handleConnectorChange(id: string) {
    setConnectorId(id);
    setPageId("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (platform === "facebook") {
      publishFb.mutate({
        connector_id: connectorId,
        page_id: pageId,
        message,
        link: link || undefined,
        image_url: imageUrl || undefined,
      }, {
        onSuccess: () => {
          setMessage("");
          setImageUrl("");
          setLink("");
        },
      });
    } else {
      publishIg.mutate({
        connector_id: connectorId,
        caption: message,
        image_url: imageUrl || undefined,
      }, {
        onSuccess: () => {
          setMessage("");
          setImageUrl("");
        },
      });
    }
  }

  const canSubmit =
    !!connectorId &&
    !!message &&
    (platform === "facebook" ? !!pageId : true) &&
    (platform === "instagram" ? !!imageUrl : true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publish Post"
        subtitle="Create and publish posts to Facebook or Instagram."
      />

      {/* Platform tabs */}
      <div className="flex gap-2">
        {(["facebook", "instagram"] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPlatform(p); setConnectorId(""); setPageId(""); }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              platform === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p === "facebook" ? <Share2 className="size-4" /> : <Camera className="size-4" />}
            {p === "facebook" ? "Facebook" : "Instagram"}
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
            {platform === "facebook" ? (
              <Share2 className="size-10 text-muted-foreground/40" />
            ) : (
              <Camera className="size-10 text-muted-foreground/40" />
            )}
            <p className="text-sm text-muted-foreground">
              No connected {platform === "facebook" ? "Facebook Pages" : "Instagram"} connector found.
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/connectors"}>
              Go to Connectors
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Connector selector */}
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

            {/* Facebook: page picker */}
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

            {/* Instagram: show connected account info */}
            {connectorId && platform === "instagram" && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                {igLoading ? (
                  <p className="text-sm text-muted-foreground">Loading account…</p>
                ) : igAccount ? (
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white">
                      <User className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">@{igAccount.username || igAccount.name}</p>
                      {igAccount.followers_count !== undefined && (
                        <p className="text-xs text-muted-foreground">{igAccount.followers_count.toLocaleString()} followers</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Could not load account info.</p>
                )}
              </div>
            )}

            {/* Post content */}
            <Field>
              <FieldLabel className="flex items-center gap-1.5">
                <FileText className="size-3.5" />
                {platform === "instagram" ? "Caption" : "Message"}
              </FieldLabel>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={platform === "instagram" ? "Write your caption…" : "What's on your mind?"}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </Field>

            {/* Image URL */}
            <Field>
              <FieldLabel className="flex items-center gap-1.5">
                <ImageIcon className="size-3.5" />
                Image URL {platform === "instagram" && <span className="text-destructive">*</span>}
              </FieldLabel>
              <Input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              {platform === "instagram" && (
                <p className="text-xs text-muted-foreground">Required for Instagram. Must be a publicly accessible URL.</p>
              )}
            </Field>

            {/* Link (Facebook only) */}
            {platform === "facebook" && (
              <Field>
                <FieldLabel className="flex items-center gap-1.5">
                  <Link2 className="size-3.5" />
                  Link (optional)
                </FieldLabel>
                <Input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://example.com"
                />
              </Field>
            )}

            <Button type="submit" disabled={!canSubmit || isPending} className="w-full">
              <Send className="mr-2 size-4" />
              {isPending ? "Publishing…" : `Publish to ${platform === "facebook" ? "Facebook" : "Instagram"}`}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
