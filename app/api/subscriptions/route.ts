import { GuardDenial, requireAdmin, requireAuth } from "@/lib/auth-guard";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  hashParams,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { createSubscriptionSchema } from "@/lib/validations/subscription";
import { NextRequest, NextResponse } from "next/server";

const ROUTE_GET = "api/subscriptions:GET";
const ROUTE_POST = "api/subscriptions:POST";

export async function GET(request: NextRequest) {
  try {
    const { organizationId, role, userId } = await requireAuth(ROUTE_GET, "GET");
    const params = request.nextUrl.searchParams;

    const limit = Math.min(parseInt(params.get("limit") || "25", 10) || 25, 100);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

    // Beneficiaries only see subscriptions tied to grants they are the
    // named beneficiary on. Org-scope alone would leak every other
    // beneficiary's SaaS subscriptions in the same nonprofit.
    const where =
      role === "beneficiary"
        ? { organizationId, grant: { is: { beneficiaryId: userId } } }
        : { organizationId };

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${organizationId}:subscriptions:list:${role}:${userId}:${hashParams(request)}`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.FINANCIAL_LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.FINANCIAL_LIST.maxStaleSeconds,
      fetcher: async () => {
        const [subscriptions, total] = await Promise.all([
          prisma.subscription.findMany({
            where,
            include: {
              vendor: { select: { id: true, name: true, type: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
          }),
          prisma.subscription.count({ where }),
        ]);
        return { subscriptions, total, limit, offset };
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
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_GET,
      method: "GET",
      cause: error,
    });
  }
}

// POST /api/subscriptions -- create a new subscription
export async function POST(request: Request) {
  try {
    await assertDbHealthy();
    const { userId, organizationId } = await requireAdmin(ROUTE_POST, "POST");

    const body = await request.json();
    const parsed = createSubscriptionSchema.safeParse(body);

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

    // Verify vendor belongs to org
    const vendor = await prisma.vendor.findFirst({
      where: { id: data.vendorId, organizationId, archivedAt: null },
    });
    if (!vendor) {
      return errorResponse({
        kind: "not_found",
        message: "Vendor not found",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
      });
    }

    // Verify grant belongs to org
    const grant = await prisma.grant.findFirst({
      where: { id: data.grantId, organizationId, archivedAt: null },
    });
    if (!grant) {
      return errorResponse({
        kind: "not_found",
        message: "Grant not found",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
      });
    }

    // Verify category belongs to grant
    const category = await prisma.budgetCategory.findFirst({
      where: { id: data.categoryId, grantId: data.grantId, organizationId },
    });
    if (!category) {
      return errorResponse({
        kind: "not_found",
        message: "Budget category not found",
        route: ROUTE_POST,
        method: "POST",
        userId,
        organizationId,
      });
    }

    const subscription = await prisma.subscription.create({
      data: {
        organizationId,
        vendorId: data.vendorId,
        grantId: data.grantId,
        categoryId: data.categoryId,
        serviceName: data.serviceName.trim(),
        loginEmail: data.loginEmail?.trim() || "",
        monthlyCost: data.monthlyCost,
        billingCycle: data.billingCycle,
        renewalDate: data.renewalDate ?? null,
        billingUpdateStatus: data.billingUpdateStatus,
        status: data.status,
      },
      include: {
        vendor: { select: { id: true, name: true, type: true, status: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "create",
        entityType: "subscription",
        entityId: subscription.id,
        newValue: {
          serviceName: subscription.serviceName,
          monthlyCost: subscription.monthlyCost.toString(),
          vendorId: subscription.vendorId,
          grantId: subscription.grantId,
        },
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_POST,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_POST,
      method: "POST",
      cause: error,
    });
  }
}
