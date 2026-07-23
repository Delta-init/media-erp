import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // "standalone" is needed for Docker (copies only runtime files).
  // Vercel's build system ignores this and uses its own output format.
  output: "standalone",

  typescript:{
    ignoreBuildErrors: true,
  },
  // Reverse-proxy /api/v1/* to the real backend — this file runs on the SERVER
  // only (Next.js config is never bundled to the browser), so it's safe to read
  // a non-NEXT_PUBLIC_ var here. The browser only ever sees this same-origin
  // path (see lib/axios.ts); the backend's actual domain/IP never reaches the
  // client, which is what stops the deployed app from being blockable by
  // domain/IP filtering.
  //
  // BACKEND_API_URL is preferred (server-only, never shipped in the client JS
  // bundle). NEXT_PUBLIC_API_URL is kept as a fallback only so existing Vercel
  // configs keep working during migration — but since a NEXT_PUBLIC_ var's
  // value is always inlined into the client bundle at build time regardless of
  // whether client code reads it, BACKEND_API_URL should be set going forward
  // and NEXT_PUBLIC_API_URL removed once it's no longer needed for SSR.
  async rewrites() {
    const apiUrl =
      process.env.BACKEND_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:8000/api/v1";
    // Not proxying against localhost just avoids a pointless local hop —
    // dev already talks to the local backend directly.
    if (apiUrl.includes("localhost")) return [];
    const backendBase = apiUrl.replace(/\/api\/v1\/?$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendBase}/api/v1/:path*`,
      },
    ];
  },
};

// Wrap with Sentry only when DSN is present; otherwise returns nextConfig unchanged.
const hasSentryDsn = !!(
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
);

export default hasSentryDsn
  ? withSentryConfig(nextConfig, {
      // Silence Sentry CLI output during build
      silent: !process.env.CI,

      // Upload source maps to Sentry for readable stack traces
      widenClientFileUpload: true,

      // Automatically instrument Next.js server routes
      autoInstrumentServerFunctions: true,

      // Disable Sentry telemetry
      telemetry: false,

      // Don't add Sentry webpack plugin when DSN is absent (already guarded above)
      disableLogger: true,
    })
  : nextConfig;
