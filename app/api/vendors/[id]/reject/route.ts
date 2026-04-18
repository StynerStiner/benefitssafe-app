// POST /api/vendors/[id]/reject — ORG-SCOPED
//
// BSRS Ch 5 P2 high-risk action: transitions vendor to BLOCKED. Reason is
// required (zod min 10) and persisted verbatim to AuditLog.newValue.reason
// for the weekly audit-log review cadence.

import { GuardDenial, requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { rejectVendorSchema } from "@/lib/validations/vendor";
import { NextResponse } from "next/server";

const ROUTE = "api/vendors/[id]/reject:POST";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, organizationId } = await requireAdmin(ROUTE, "POST");

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = rejectVendorSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: parsed.error.issues[0].message,
        route: ROUTE,
        method: "POST",
        userId,
        organizationId,
      });
    }
    const reason = parsed.data.reason.trim();

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
      data: { status: "BLOCKED" },
      select: { id: true, name: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "reject",
        entityType: "vendor",
        entityId: id,
        oldValue: JSON.parse(JSON.stringify({ status: vendor.status })),
        newValue: JSON.parse(JSON.stringify({ status: "BLOCKED", reason })),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
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
