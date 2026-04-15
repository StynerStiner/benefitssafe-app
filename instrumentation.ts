// Next.js instrumentation hook — runs once per server process at boot.
//
// Three things happen here:
//   1. Sentry server/edge config is loaded so error capture is live
//      before the first request hits a route handler.
//   2. Production environments are asserted to have Upstash Redis
//      configured. In-memory rate limiting is per-Lambda and effectively
//      useless across 1.8M concurrent tenants; without a shared Redis
//      backend, login brute-force protection and card issuance throttles
//      both fall apart at scale. Fail the boot, not the request.
//   3. onRequestError forwards server runtime errors to Sentry.

function assertProductionRedis() {
  if (process.env.NODE_ENV !== "production") return;

  // Vercel build environment does NOT need Redis at build time — only
  // runtime. Check for NEXT_PHASE to skip the assertion during `next build`.
  // See https://nextjs.org/docs/app/api-reference/config/next-config-js/env
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const hasUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!hasUrl || !hasToken) {
    throw new Error(
      "[startup] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production. " +
        "In-memory rate limiting is per-Lambda and not safe for multi-tenant traffic — " +
        "configure Upstash Redis in Vercel env vars and redeploy.",
    );
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertProductionRedis();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime can't import the pg adapter, so Prisma-backed
    // assertions don't apply here, but we still enforce the Redis
    // env var check — middleware rate limits run in the edge runtime.
    assertProductionRedis();
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  err: { digest: string } & Error,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string },
) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(err, request, context);
};
