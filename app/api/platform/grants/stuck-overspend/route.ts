// GET /api/platform/grants/stuck-overspend
//
// Lists Grant rows with allowNegativeBalance=true AND remainingAmount>=0 —
// "stuck" candidates whose flag was never cleared back to false after the
// balance was restored. Backs the platform-admin stuck-grants page which
// offers a manual reset via the sibling reset-negative-balance-flag
// endpoint. See docs/runbooks/stuck-overspend-grants.md.

import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { withOrgContext } from "@/lib/org-context";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/platform/grants/stuck-overspend:GET";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // cachedWithStaleness nests INSIDE withOrgContext so the Prisma
    // org-scoping extension sees the exempt marker during degraded-mode
    // fetches too. Mirrors Tier 2 expenses/[id] precedent.
    return withOrgContext(
      {
        kind: "exempt",
        reason: "PLATFORM_ADMIN",
        note: "stuck-overspend-list",
      },
      async () => {
        const staleResult = await cachedWithStaleness({
          key: `${STALE_CACHE_KEY_PREFIX}:platform:grants:stuck-overspend:default`,
          ttlSeconds: jitterTtl(STALE_CACHE_TTL.PLATFORM_STATS.ttlSeconds),
          maxStaleSeconds: STALE_CACHE_TTL.PLATFORM_STATS.maxStaleSeconds,
          fetcher: async () => {
            const grants = await prisma.grant.findMany({
              where: {
                allowNegativeBalance: true,
                remainingAmount: { gte: 0 },
              },
              select: {
                id: true,
                organizationId: true,
                remainingAmount: true,
                updatedAt: true,
                organization: { select: { name: true } },
              },
              orderBy: { updatedAt: "asc" },
            });
            return {
              grants: grants.map((g) => ({
                id: g.id,
                organizationId: g.organizationId,
                organization: { name: g.organization.name },
                remainingAmount: Number(g.remainingAmount),
                updatedAt: g.updatedAt.toISOString(),
              })),
            };
          },
        });

        if (staleResult.kind === "unavailable") {
          return errorResponse({
            kind: "dependency_unavailable",
            message: "Aurora is currently unavailable; please retry.",
            route: ROUTE_GET,
            method: "GET",
            retryAfterSeconds: 30,
          });
        }

        if (staleResult.kind === "stale") {
          return NextResponse.json(
            {
              ...staleResult.data,
              _meta: {
                stale: true,
                staleSeconds: staleResult.staleSeconds,
                cachedAt: staleResult.cachedAt,
              },
            },
            { headers: { "X-Data-Staleness": String(staleResult.staleSeconds) } },
          );
        }

        return NextResponse.json(staleResult.data);
      },
    );
  } catch (error) {
    console.error("GET /api/platform/grants/stuck-overspend error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
