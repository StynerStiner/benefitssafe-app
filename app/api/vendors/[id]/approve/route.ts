// POST /api/vendors/[id]/approve — ORG-SCOPED

import { GuardDenial, requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE = "api/vendors/[id]/approve:POST";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const { userId, organizationId } = await requireAdmin(ROUTE, "POST");

    const { id } = await params;

    const vendor = await prisma.vendor.findFirst({
      where: { id, organizationId, archivedAt: null },
      select: { id: true, name: true, status: true },
    });

    if (!vendor) {
      return errorResponse({
        kind: "not_found",
        message: "Vendor not found",
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
      });
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
      select: { id: true, name: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "approve",
        entityType: "vendor",
        entityId: id,
        oldValue: JSON.parse(JSON.stringify({ status: vendor.status })),
        newValue: JSON.parse(JSON.stringify({ status: "APPROVED" })),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE,
      method: "POST",
      cause: error,
    });
  }
}
