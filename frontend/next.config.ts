import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // "standalone" is needed for Docker (copies only runtime files).
  // Vercel's build system ignores this and uses its own output format.
  output: "standalone",

  typescript:{
    ignoreBuildErrors: true,
  },
  // In production (Vercel/Docker) NEXT_PUBLIC_API_URL points directly to the backend.
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
    // Only proxy when running against a remote backend (not localhost)
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
