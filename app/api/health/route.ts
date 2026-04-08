import { prisma } from "@/lib/db";
import { redis } from "@/lib/cache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { status: "ok" | "degraded" | "down"; latencyMs: number }> = {};

  // Check database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: "down", latencyMs: Date.now() - dbStart };
  }

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
