// GET /api/memberships -- List current user's organization memberships (for org picker)

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

const ROUTE_GET = "api/memberships:GET";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:user:${userId}:memberships:default`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () =>
        prisma.organizationMembership.findMany({
          where: {
            userId,
            status: "active",
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },
          },
          orderBy: { lastAccessedAt: "desc" },
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

    // This route returns a bare array at the top level, so we signal
    // staleness via the X-Data-Staleness header only (no _meta envelope,
    // which would require changing the response shape to an object and
    // breaking existing client code that does `response.data.map(...)`).
    const headers: Record<string, string> = {};
    if (staleResult.kind === "stale") {
      headers["X-Data-Staleness"] = String(staleResult.staleSeconds);
    }
    return NextResponse.json(staleResult.data, { headers });
  } catch (error) {
    console.error("GET /api/memberships error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
