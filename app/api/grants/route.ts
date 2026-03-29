// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { cached, invalidateCacheByPrefix, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";
import { prisma } from "@/lib/db";
import { captureApiError } from "@/lib/error-handler";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { createGrantSchema } from "@/lib/validations/grant";
import { NextResponse } from "next/server";

// GET /api/grants — list grants scoped to organization (paginated)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
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

    return NextResponse.json(result);
  } catch (error) {
    captureApiError(error, { route: "GET /api/grants" });
    console.error("GET /api/grants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/grants — create a new grant
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 10 requests per minute per user
    const rateLimitResult = rateLimit(
      `grant-create:${session.user.id}`,
      RATE_LIMIT_CONFIGS.grantCreate,
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = createGrantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

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
        status: "ACTIVE",
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

    // Invalidate all cached grant listings for this org (covers all pagination variants)
    await invalidateCacheByPrefix(CACHE_KEYS.orgGrants(organizationId));

    return NextResponse.json(grant, { status: 201 });
  } catch (error) {
    captureApiError(error, { route: "POST /api/grants" });
    console.error("POST /api/grants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
