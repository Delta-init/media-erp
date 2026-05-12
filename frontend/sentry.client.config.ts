// Sentry browser SDK — initialised only when NEXT_PUBLIC_SENTRY_DSN is set.
// Leave the env var empty in development to skip Sentry entirely.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",

    // Capture 20% of performance traces in production
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 0,

    // Record user sessions: 10% normally, 100% on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Strip PII from breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "xhr" || breadcrumb.category === "fetch") {
        return breadcrumb;
      }
      return breadcrumb;
    },
  });
}
