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

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  // LinkedIn scope errors — both codes mean MDP not approved
  invalid_scope_error:     MDP_MESSAGE,
  unauthorized_scope_error: MDP_MESSAGE,
  access_denied:
    "You cancelled the connection. Try again and allow the requested permissions.",
  missing_code:
    "OAuth did not return an authorisation code. Please try again.",
};

function friendlyOAuthError(code: string, platform: string | null): string {
  if (OAUTH_ERROR_MESSAGES[code]) return OAUTH_ERROR_MESSAGES[code];
  // Catch-all for any *scope* error from any platform
  if (code.includes("scope")) return MDP_MESSAGE;
  const label =
    platform && PLATFORM_META[platform as ConnectorPlatform]
      ? PLATFORM_META[platform as ConnectorPlatform].label
      : (platform ?? "this platform");
  return `Could not connect ${label}: ${code.replaceAll("_", " ")}.`;
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
