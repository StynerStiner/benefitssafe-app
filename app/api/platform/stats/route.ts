// PLATFORM ADMIN ONLY: Cross-organization aggregate stats.
// No org scoping — platform_admin sees everything.

import { GuardDenial, requirePlatformAdmin } from "@/lib/auth-guard";
import {
  CACHE_KEYS,
  CACHE_TTL,
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cached,
  cachedWithStaleness,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { withOrgContext } from "@/lib/org-context";
import { NextResponse } from "next/server";

const ROUTE = "api/platform/stats:GET";

export async function GET() {
  try {
    await requirePlatformAdmin(ROUTE, "GET");

    return withOrgContext(
      { kind: "exempt", reason: "PLATFORM_ADMIN", note: "stats" },
      async () => {
    // Layered caches: the inner cached() is the P4 perf cache (60s TTL,
    // write-through). The outer cachedWithStaleness adds a degraded-mode
    // fallback on top — when Aurora is down, the outer cache can serve
    // a copy up to STALE_CACHE_TTL.PLATFORM_STATS.maxStaleSeconds old
    // even if the inner perf entry has expired.
    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:platform:stats:default`,
      ttlSeconds: STALE_CACHE_TTL.PLATFORM_STATS.ttlSeconds,
      maxStaleSeconds: STALE_CACHE_TTL.PLATFORM_STATS.maxStaleSeconds,
      fetcher: () =>
        cached(CACHE_KEYS.platformStats(), CACHE_TTL.SHORT, async () => {
          const [
            totalOrgs,
            totalUsers,
            totalGrants,
            activeGrants,
            recentOrgs,
            recentUsers,
          ] = await Promise.all([
            prisma.organization.count(),
            prisma.user.count(),
            prisma.grant.count(),
            prisma.grant.count({ where: { status: "ACTIVE" } }),
            prisma.organization.findMany({
              orderBy: { createdAt: "desc" },
              take: 10,
              include: { _count: { select: { users: true } } },
            }),
            prisma.user.findMany({
              orderBy: { createdAt: "desc" },
              take: 10,
              select: {
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                createdAt: true,
              },
            }),
          ]);

          return {
            totalOrgs,
            totalUsers,
            totalGrants,
            activeGrants,
            recentOrgs,
            recentUsers,
          };
        }),
    });

    if (staleResult.kind === "unavailable") {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "GET",
        retryAfterSeconds: 30,
      });
    }

    if (staleResult.kind === "stale") {
      return NextResponse.json(
        {
          data: staleResult.data,
          _meta: {
            stale: true,
            staleSeconds: staleResult.staleSeconds,
            cachedAt: staleResult.cachedAt,
          },
        },
        { headers: { "X-Data-Staleness": String(staleResult.staleSeconds) } },
      );
    }

    return NextResponse.json({ data: staleResult.data });
      },
    );
  } catch (error) {
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE,
      method: "GET",
      cause: error,
    });
  }
}
