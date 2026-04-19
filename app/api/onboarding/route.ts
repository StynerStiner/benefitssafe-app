// GET /api/onboarding — first-run setup checklist.
//
// Returns the org's onboarding status derived from live DB counts. Scoped to
// the active organization in the session. Admin-only: other roles get an
// empty/complete response so the widget never renders for them.

import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { computeOnboardingStatus } from "@/lib/onboarding";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/onboarding:GET";
const ADMIN_ROLES = new Set(["nonprofit_admin", "platform_admin"]);

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, role } = session.user;

    // Non-admins never see the onboarding checklist, so pretend it's done.
    // Short-circuit BEFORE the cache/Aurora dance — no DB hit, no cache entry.
    if (!ADMIN_ROLES.has(role)) {
      return NextResponse.json({
        steps: [],
        completedCount: 0,
        totalCount: 0,
        requiredCount: 0,
        requiredCompletedCount: 0,
        isComplete: true,
      });
    }

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${organizationId}:onboarding:default`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () => computeOnboardingStatus(prisma, organizationId),
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

    const headers: Record<string, string> = {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=30",
    };
    if (staleResult.kind === "stale") {
      headers["X-Data-Staleness"] = String(staleResult.staleSeconds);
      return NextResponse.json(
        {
          ...staleResult.data,
          _meta: {
            stale: true,
            staleSeconds: staleResult.staleSeconds,
            cachedAt: staleResult.cachedAt,
          },
        },
        { headers },
      );
    }

    return NextResponse.json(staleResult.data, { headers });
  } catch (error) {
    console.error("GET /api/onboarding error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
