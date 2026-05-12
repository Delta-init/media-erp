import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // "standalone" is needed for Docker (copies only runtime files).
  // Vercel's build system ignores this and uses its own output format.
  output: "standalone",
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
