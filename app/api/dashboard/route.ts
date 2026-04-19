// GET /api/dashboard — consolidated read-only endpoint for dashboard page loads.
// Returns role-scoped data in a single response, cached for 60 seconds.
// Individual CRUD routes (/api/expenses, /api/grants, etc.) remain unchanged.

import * as Sentry from "@sentry/nextjs";
import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  hashParams,
} from "@/lib/cache";
import { getDashboardData } from "@/lib/data";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE = "api/dashboard:GET";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;

    const cacheKey = `${STALE_CACHE_KEY_PREFIX}:${organizationId ?? "none"}:dashboard:${role}:${userId}:${hashParams(request)}`;
    const result = await cachedWithStaleness({
      key: cacheKey,
      ttlSeconds: STALE_CACHE_TTL.DASHBOARD.ttlSeconds,
      maxStaleSeconds: STALE_CACHE_TTL.DASHBOARD.maxStaleSeconds,
      fetcher: () => getDashboardData(role, userId, organizationId, { limit: 100 }),
    });

    if (result.kind === "unavailable") {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "GET",
        retryAfterSeconds: 30,
      });
    }

    const headers: Record<string, string> = {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=30",
    };
    if (result.kind === "stale") {
      headers["X-Data-Staleness"] = String(result.staleSeconds);
      return NextResponse.json(
        {
          ...result.data,
          _meta: {
            stale: true,
            staleSeconds: result.staleSeconds,
            cachedAt: result.cachedAt,
          },
        },
        { headers },
      );
    }

    return NextResponse.json(result.data, { headers });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { route: '/api/dashboard', method: 'GET' },
    });
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
