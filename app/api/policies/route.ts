// @ts-nocheck
import { auth } from "@/auth";
import {
  cached,
  invalidateCache,
  CACHE_KEYS,
  CACHE_TTL,
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { updatePolicySchema } from "@/lib/validations/policy";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/policies:GET";
const ROUTE_PATCH = "api/policies:PATCH";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.organizationId;

    // Layered cache: inner cached() is the P4 perf cache; outer
    // cachedWithStaleness adds degraded-mode fallback. Same layering as
    // grants/route.ts + vendors/route.ts.
    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${orgId}:policies:default`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.ORG_SETTINGS.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.ORG_SETTINGS.maxStaleSeconds,
      fetcher: () =>
        cached(
          CACHE_KEYS.orgPolicies(orgId),
          CACHE_TTL.MEDIUM,
          () => prisma.disbursementPolicy.findFirst({
            where: { organizationId: orgId },
          }),
        ),
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

    const headers: Record<string, string> = {};
    if (staleResult.kind === "stale") {
      headers["X-Data-Staleness"] = String(staleResult.staleSeconds);
    }

    return NextResponse.json(staleResult.data, { headers });
  } catch (error) {
    console.error("GET /api/policies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updatePolicySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Capture the old value for audit log
    const existingPolicy = data.id
      ? await prisma.disbursementPolicy.findUnique({ where: { id: data.id } })
      : null;

    const policy = await prisma.disbursementPolicy.upsert({
      where: { id: data.id || "nonexistent" },
      update: {
        cashToRecipient: data.cashToRecipient,
        reimbursementToRecipient: data.reimbursementToRecipient,
        rentUtilityPayments: data.rentUtilityPayments,
        recurringSubscriptions: data.recurringSubscriptions,
        maxSingleTransaction: data.maxSingleTransaction,
        allowedCategories: data.allowedCategories,
        blockedCategories: data.blockedCategories,
      },
      create: {
        organizationId,
        cashToRecipient: data.cashToRecipient || "DISALLOWED",
        reimbursementToRecipient: data.reimbursementToRecipient || "DISALLOWED",
        rentUtilityPayments: data.rentUtilityPayments || "REQUIRES_REVIEW",
        recurringSubscriptions: data.recurringSubscriptions || "ALLOWED",
        maxSingleTransaction: data.maxSingleTransaction,
        allowedCategories: data.allowedCategories,
        blockedCategories: data.blockedCategories,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: existingPolicy ? "update" : "create",
        entityType: "disbursement_policy",
        entityId: policy.id,
        oldValue: existingPolicy
          ? {
              cashToRecipient: existingPolicy.cashToRecipient,
              reimbursementToRecipient: existingPolicy.reimbursementToRecipient,
              rentUtilityPayments: existingPolicy.rentUtilityPayments,
              recurringSubscriptions: existingPolicy.recurringSubscriptions,
              maxSingleTransaction: existingPolicy.maxSingleTransaction?.toString() ?? null,
            }
          : undefined,
        newValue: {
          cashToRecipient: policy.cashToRecipient,
          reimbursementToRecipient: policy.reimbursementToRecipient,
          rentUtilityPayments: policy.rentUtilityPayments,
          recurringSubscriptions: policy.recurringSubscriptions,
          maxSingleTransaction: policy.maxSingleTransaction?.toString() ?? null,
        },
      },
    });

    // Invalidate cached policy for this org
    await invalidateCache(CACHE_KEYS.orgPolicies(organizationId));

    return NextResponse.json(policy);
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_PATCH,
        method: "PATCH",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    console.error("PATCH /api/policies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
