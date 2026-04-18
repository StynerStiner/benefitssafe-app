// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import * as Sentry from "@sentry/nextjs";
import { GuardDenial, requireAdmin, requireAuth } from "@/lib/auth-guard";
import { cached, invalidateCacheByPrefix, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { invalidateDashboardCache } from "@/lib/data";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { createGrantSchema } from "@/lib/validations/grant";
import { checkLimitAccess, buildLimitReachedResponse } from "@/lib/feature-gates";
import { incrementUsage } from "@/lib/usage-tracker";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/grants:GET";
const ROUTE_POST = "api/grants:POST";

// GET /api/grants — list grants scoped to organization (paginated)
export async function GET(request: Request) {
  try {
    const { session, organizationId, role } = await requireAuth(ROUTE_GET, "GET");
    const { searchParams } = new URL(request.url);

    // Parse and validate pagination params
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    // Beneficiaries only see their own grants
    const where =
      role === "beneficiary"
        ? { organizationId, beneficiaryId: session.user.id, archivedAt: null }
        : { organizationId, archivedAt: null };

    // Cache key includes role, pagination, and org to avoid cross-tenant leaks
    const cacheKey = `${CACHE_KEYS.orgGrants(organizationId)}:${role}:${limit}:${offset}`;

    const result = await cached(cacheKey, CACHE_TTL.SHORT, async () => {
      const [grants, total] = await Promise.all([
        prisma.grant.findMany({
          where,
          include: {
            beneficiary: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
            categories: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.grant.count({ where }),
      ]);
      return { data: grants, total, limit, offset };
    });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=15' },
    });
  } catch (error) {
    if (error instanceof GuardDenial) return error.toErrorResponse();
    Sentry.captureException(error, {
      tags: { route: '/api/grants', method: 'GET' },
    });
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_GET,
      method: "GET",
      cause: error,
    });
  }
}

// POST /api/grants — create a new grant
export async function POST(request: Request) {
  try {
    const { session, userId, organizationId } = await requireAdmin(ROUTE_POST, "POST");

    // Rate limit: 10 requests per minute per user
    const rateLimitResult = rateLimit(
      `grant-create:${session.user.id}`,
      RATE_LIMIT_CONFIGS.grantCreate,
    );
    if (!rateLimitResult.allowed) {
      return errorResponse({
        kind: "validation",
        message: "Too many requests. Please slow down.",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      });
    }

    const body = await request.json();
    const parsed = createGrantSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
        extraBody: { details: parsed.error.flatten() },
      });
    }

    const data = parsed.data;

    // Plan limit gate: check active grant count against tier limit
    const currentGrantCount = await prisma.grant.count({
      where: { organizationId, archivedAt: null },
    });
    const limitCheck = await checkLimitAccess(
      organizationId,
      "maxGrants",
      currentGrantCount,
    );
    if (!limitCheck.allowed) {
      return errorResponse({
        kind: "forbidden",
        message: "Grant creation limit reached for this period",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
        extraBody: buildLimitReachedResponse("maxGrants", limitCheck),
      });
    }

    const grant = await prisma.grant.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        grantIssuerName: data.grantIssuerName,
        grantIssuerContact: data.grantIssuerContact,
        beneficiaryId: data.beneficiaryId || null,
        totalAmount: data.totalAmount,
        remainingAmount: data.totalAmount,
        startDate: data.startDate,
        endDate: data.endDate,
        restrictions: data.restrictions,
        benefitFlags: data.benefitFlags ?? undefined,
        purpose: data.purpose,
        blockedMCCs: data.blockedMCCs ?? undefined,
        status: data.status || "ACTIVE",
      },
      include: {
        beneficiary: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "create",
        entityType: "grant",
        entityId: grant.id,
        newValue: {
          name: grant.name,
          totalAmount: grant.totalAmount.toString(),
          grantIssuerName: grant.grantIssuerName,
        },
      },
    });

    // Increment usage counter for this month
    await incrementUsage(organizationId, "grantsCreated");

    // Invalidate all cached grant listings for this org (covers all pagination variants)
    await invalidateCacheByPrefix(CACHE_KEYS.orgGrants(organizationId));
    // Also invalidate the dashboard roll-up so the new grant shows up
    // immediately instead of waiting for the Redis TTL. (DDIA Ch5 audit.)
    await invalidateDashboardCache(organizationId);

    return NextResponse.json(grant, { status: 201 });
  } catch (error) {
    if (error instanceof GuardDenial) return error.toErrorResponse();
    Sentry.captureException(error, {
      tags: { route: '/api/grants', method: 'POST' },
    });
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_POST,
      method: "POST",
      cause: error,
    });
  }
}
