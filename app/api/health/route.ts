import { redis } from "@/lib/cache";
import { getDbHealth } from "@/lib/db-health";
import { NextResponse } from "next/server";
import { logger, flushLogs } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { status: "ok" | "degraded" | "down"; latencyMs: number }> = {};

  // BSRS Ch 8 P2a — database probe is cached in lib/db-health. The
  // client banner polls /api/health every 30s across all authenticated
  // users; without the cache each poll would run a fresh SELECT 1 on
  // Aurora. The cache TTL (30s) is tuned so banner freshness and
  // Aurora load stay in the right ballpark — tune in db-health.ts,
  // not here. "healthy" internally maps to "ok" here to preserve the
  // pre-P2a response contract consumed by the banner and /api/health
  // probers (Better Stack, Vercel, uptime monitors).
  const db = await getDbHealth();
  checks.database = {
    status: db.status === "healthy" ? "ok" : db.status,
    latencyMs: db.latencyMs,
  };

  // Check Redis (optional — degraded if unavailable)
  const redisStart = Date.now();
  if (redis) {
    try {
      await redis.ping();
      checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
    } catch {
      checks.redis = { status: "degraded", latencyMs: Date.now() - redisStart };
    }
  } else {
    checks.redis = { status: "degraded", latencyMs: 0 };
  }

  const overall = Object.values(checks).some((c) => c.status === "down")
    ? "down"
    : Object.values(checks).some((c) => c.status === "degraded")
      ? "degraded"
      : "ok";

  logger.info("Health check", {
    overall,
    dbStatus: checks.database?.status,
    dbLatencyMs: checks.database?.latencyMs,
    redisStatus: checks.redis?.status,
  });
  await flushLogs();

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      checks,
    },
    {
      status: overall === "down" ? 503 : 200,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    },
  );
}
