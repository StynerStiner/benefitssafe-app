// GET /api/reports/grants — List grant reports for the org

import { auth } from "@/auth";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  hashParams,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { NextRequest, NextResponse } from "next/server";

const ROUTE_GET = "api/reports/grants:GET";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    const reportsAllowedRoles = [
      "nonprofit_admin", "nonprofit_staff", "cpa", "auditor",
      "platform_admin", "attorney", "compliance_officer",
      "grant_officer",
    ];
    if (!reportsAllowedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const grantId = params.get("grantId");
    const limit = Math.min(parseInt(params.get("limit") || "20"), 100);
    const offset = Math.max(parseInt(params.get("offset") || "0"), 0);

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${organizationId}:reports:grants:${hashParams(request)}`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.REPORTS.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.REPORTS.maxStaleSeconds,
      fetcher: async () => {
        const where: Record<string, unknown> = { organizationId };
        if (grantId) where.grantId = grantId;

        const [reports, total] = await Promise.all([
          prisma.grantReport.findMany({
            where: where as never,
            orderBy: { generatedAt: "desc" },
            take: limit,
            skip: offset,
          }),
          prisma.grantReport.count({ where: where as never }),
        ]);

        return { reports, total, limit, offset };
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
  } catch (error) {
    console.error("GET /api/reports/grants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
