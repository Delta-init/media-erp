// Next.js Instrumentation hook — registers Sentry on server and edge runtimes.
// This file is loaded automatically by Next.js when `instrumentation` is enabled
// (enabled by default in Next.js 15+).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
