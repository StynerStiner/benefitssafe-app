import { redis } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { getDbHealth } from "@/lib/db-health";
import { checkSchemaVersion } from "@/lib/schema-version";
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

  // Nygard Ch 17 p. 271 — surface business-transaction signal alongside
  // system health so a "green" probe can't hide zero flow. Skipped when
  // the DB is already "down" (no point re-hitting it) and wrapped so a
  // slow/failing count never degrades the probe itself.
  let business: {
    orgs_total: number;
    expenses_24h: number;
    active_cards: number;
    sampled_at: string;
  } | null = null;
  if (overall !== "down") {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [orgsTotal, expenses24h, activeCards] = await prisma.$transaction(
        async (tx) =>
          Promise.all([
            tx.organization.count(),
            tx.expenseRequest.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
            tx.virtualCard.count({ where: { status: "ACTIVE" } }),
          ]),
        { timeout: 3000 },
      );
      business = {
        orgs_total: orgsTotal,
        expenses_24h: expenses24h,
        active_cards: activeCards,
        sampled_at: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn("Health business metrics query failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      business = null;
    }
  }

  // Nygard Ch 18 p.319 — surface schema/app version drift in the health
  // probe so Better Stack pages immediately when a deploy ships ahead of
  // (or behind) its migration. checkSchemaVersion never throws; same
  // "degraded but responsive" posture as the business block above.
  const schemaVersion =
    overall === "down"
      ? { expected: 0, actual: null, match: false as const }
      : await checkSchemaVersion().then((r) => ({
          expected: r.expected,
          actual: r.actual,
          match: r.match,
        }));

  logger.info("Health check", {
    overall,
    dbStatus: checks.database?.status,
    dbLatencyMs: checks.database?.latencyMs,
    redisStatus: checks.redis?.status,
    businessSampled: business !== null,
    schemaVersionMatch: schemaVersion.match,
  });
  await flushLogs();

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      // BSRS Ch 8 P3c — identify which channel is serving the probe
      // so the operator can verify traffic split end-to-end (also
      // consumed by the comparison dashboard in Better Stack).
      deploy_channel: process.env.DEPLOY_CHANNEL || "stable",
      commit_sha: process.env.VERCEL_GIT_COMMIT_SHA || "local",
      checks,
      business,
      schema_version: schemaVersion,
    },
    {
      status: overall === "down" ? 503 : 200,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    },
  );
}
