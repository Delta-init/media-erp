// Sentry Node.js SDK — loaded by instrumentation.ts on server startup.
// No-op when SENTRY_DSN (server-side) or NEXT_PUBLIC_SENTRY_DSN is absent.
import * as Sentry from "@sentry/nextjs";

const dsn =
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,
    // No replay on server
  });
}
