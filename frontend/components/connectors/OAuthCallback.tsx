"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PLATFORM_META } from "@/lib/platformMeta";
import type { ConnectorPlatform } from "@/types/connector";

const MDP_MESSAGE =
  "LinkedIn Ads requires Marketing Developer Platform (MDP) access. " +
  "Go to linkedin.com/developers/apps → your app → Products → request " +
  '"Marketing Developer Platform", then try again once approved.';

const INSTAGRAM_BUSINESS_MESSAGE =
  "Instagram only supports Business and Creator accounts. " +
  "Go to your Instagram profile → Settings → Account type and tools → " +
  "Switch to Professional account, then try connecting again.";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  // LinkedIn scope errors — both codes mean MDP not approved
  invalid_scope_error:      MDP_MESSAGE,
  unauthorized_scope_error: MDP_MESSAGE,
  access_denied:
    "You cancelled the connection. Try again and allow the requested permissions.",
  missing_code:
    "OAuth did not return an authorisation code. Please try again.",
  instagram_not_configured:
    "Instagram is not configured on the server. Please set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in the server .env file.",
};

function friendlyOAuthError(raw: string, platform: string | null): string {
  // 1. Exact key match
  if (OAUTH_ERROR_MESSAGES[raw]) return OAUTH_ERROR_MESSAGES[raw];

  // 2. LinkedIn scope catch-all
  if (raw.includes("scope")) return MDP_MESSAGE;

  // 3. Instagram-specific patterns (server now sends clean messages)
  if (
    platform === "instagram_login" ||
    platform === "instagram"
  ) {
    if (
      raw.toLowerCase().includes("business") ||
      raw.toLowerCase().includes("creator") ||
      raw.toLowerCase().includes("exchange") ||
      raw.toLowerCase().includes("190") // token expired / invalid app
    ) {
      return INSTAGRAM_BUSINESS_MESSAGE;
    }
    if (
      raw.toLowerCase().includes("redirect_uri") ||
      raw.toLowerCase().includes("redirect uri")
    ) {
      return (
        "Instagram redirect URI mismatch. Make sure the callback URL is added " +
        "to your Meta app → Instagram → API setup → Valid OAuth Redirect URIs."
      );
    }
    if (
      raw.toLowerCase().includes("secret") ||
      raw.toLowerCase().includes("credentials") ||
      raw.toLowerCase().includes("app_id") ||
      raw.toLowerCase().includes("not configured")
    ) {
      return OAUTH_ERROR_MESSAGES.instagram_not_configured;
    }
  }

  const label =
    platform && PLATFORM_META[platform as ConnectorPlatform]
      ? PLATFORM_META[platform as ConnectorPlatform].label
      : (platform ?? "this platform");

  // 4. If the raw value looks like a full human-readable sentence (has spaces),
  //    display it directly — don't mangle it with replaceAll("_", " ")
  if (raw.includes(" ")) {
    return `Could not connect ${label}: ${raw}`;
  }

  // 5. Simple underscore-coded error key
  return `Could not connect ${label}: ${raw.replaceAll("_", " ")}.`;
}

export function OAuthCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const handled = useRef(false);

  useEffect(() => {
    const connected   = params.get("connected") as ConnectorPlatform | null;
    const oauthError  = params.get("oauth_error");   // set by backend on denial/error
    const legacyError = params.get("error");          // keep backward-compat
    const platform    = params.get("platform");

    if (!connected && !oauthError && !legacyError) return;
    if (handled.current) return;
    handled.current = true;

    if (connected && PLATFORM_META[connected]) {
      toast.success(`${PLATFORM_META[connected].label} connected successfully!`);
      qc.invalidateQueries({ queryKey: ["connectors"] });
    } else if (oauthError) {
      toast.error(friendlyOAuthError(oauthError, platform), { duration: 8000 });
    } else if (legacyError) {
      toast.error("OAuth failed. Please try again.");
    }

    // Strip all OAuth-related query params without triggering a navigation
    const url = new URL(window.location.href);
    ["connected", "error", "oauth_error", "platform"].forEach((k) =>
      url.searchParams.delete(k)
    );
    router.replace(url.pathname + url.search, { scroll: false });
  }, [params, qc, router]);

  return null;
}
