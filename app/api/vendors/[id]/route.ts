// ORG-SCOPED vendor detail + update
// GET    /api/vendors/[id]
// PATCH  /api/vendors/[id]
// DELETE /api/vendors/[id]

import { GuardDenial, requireAdmin, requireAuth } from "@/lib/auth-guard";
import {
  STALE_CACHE_KEY_PREFIX,
  STALE_CACHE_TTL,
  cachedWithStaleness,
  jitterTtl,
} from "@/lib/cache";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { updateVendorSchema } from "@/lib/validations/vendor";
import { NextResponse } from "next/server";

const ROUTE_GET = "api/vendors/[id]:GET";
const ROUTE_PATCH = "api/vendors/[id]:PATCH";
const ROUTE_DELETE = "api/vendors/[id]:DELETE";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, organizationId } = await requireAuth(ROUTE_GET, "GET");
    const { id } = await params;

    const staleResult = await cachedWithStaleness({
      key: `${STALE_CACHE_KEY_PREFIX}:${organizationId}:vendors:detail:${id}`,
      ttlSeconds: jitterTtl(STALE_CACHE_TTL.LIST.ttlSeconds),
      maxStaleSeconds: STALE_CACHE_TTL.LIST.maxStaleSeconds,
      fetcher: () => buildVendorDetailResponse(organizationId, id),
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
      return errorResponse({
        kind: "not_found",
        message: "Vendor not found",
        route: ROUTE_GET,
        method: "GET",
        userId,
        organizationId,
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

async function buildVendorDetailResponse(organizationId: string, id: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { id, organizationId, archivedAt: null },
    include: {
      expenses: {
        select: {
          id: true,
          description: true,
          amount: true,
          status: true,
          expenseType: true,
          createdAt: true,
          grant: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      virtualCards: {
        select: {
          id: true,
          last4: true,
          spendingCap: true,
          status: true,
          cardType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { expenses: true } },
    },
  });

  if (!vendor) return null;

  // Calculate total paid
  const totalPaid = vendor.expenses
    .filter((e) => e.status === "PAID" || e.status === "APPROVED")
    .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);

  const lastTransaction = vendor.expenses[0]?.createdAt || null;

  return {
    ...vendor,
    totalPaid: totalPaid.toFixed(2),
    lastTransaction,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const { userId, organizationId } = await requireAdmin(ROUTE_PATCH, "PATCH");

    const { id } = await params;
    const body = await request.json();
    const parsed = updateVendorSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId,
        organizationId,
        extraBody: { details: parsed.error.flatten().fieldErrors },
      });
    }

    const existing = await prisma.vendor.findFirst({
      where: { id, organizationId, archivedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return errorResponse({
        kind: "not_found",
        message: "Vendor not found",
        route: ROUTE_PATCH,
        method: "PATCH",
        userId,
        organizationId,
      });
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: parsed.data as never,
      select: { id: true, name: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "update",
        entityType: "vendor",
        entityId: id,
        newValue: JSON.parse(JSON.stringify(parsed.data)),
      },
    });

    return NextResponse.json(updated);
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
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_PATCH,
      method: "PATCH",
      cause: error,
    });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const { userId, organizationId } = await requireAdmin(ROUTE_DELETE, "DELETE");

    const { id } = await params;

    const existing = await prisma.vendor.findFirst({
      where: { id, organizationId, archivedAt: null },
      select: { id: true, name: true, status: true },
    });

    if (!existing) {
      return errorResponse({
        kind: "not_found",
        message: "Vendor not found",
        route: ROUTE_DELETE,
        method: "DELETE",
        userId,
        organizationId,
      });
    }

    await prisma.vendor.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "archive",
        entityType: "vendor",
        entityId: id,
        oldValue: JSON.parse(JSON.stringify({ status: existing.status })),
        newValue: JSON.parse(JSON.stringify({ archivedAt: new Date().toISOString() })),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_DELETE,
        method: "DELETE",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE_DELETE,
      method: "DELETE",
      cause: error,
    });
  }
}
