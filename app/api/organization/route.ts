// GET /api/organization — Get current user's organization info

import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/organization:GET";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = session.user;

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${organizationId}:organization:default`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.ORG_SETTINGS.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.ORG_SETTINGS.maxStaleSeconds,
      fetcher: () =>
        prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            logoUrl: true,
            website: true,
            phone: true,
          },
        }),
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

    if (staleResult.data === null) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
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
  } catch (error) {
    console.error("GET /api/organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
