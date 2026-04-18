// POST /api/vendors/[id]/reject — ORG-SCOPED
//
// BSRS Ch 5 P2 high-risk action: transitions vendor to BLOCKED. Reason is
// required (zod min 10) and persisted verbatim to AuditLog.newValue.reason
// for the weekly audit-log review cadence.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { rejectVendorSchema } from "@/lib/validations/vendor";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = rejectVendorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }
    const reason = parsed.data.reason.trim();

    const vendor = await prisma.vendor.findFirst({
      where: { id, organizationId, archivedAt: null },
      select: { id: true, name: true, status: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: { status: "BLOCKED" },
      select: { id: true, name: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
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
    console.error("POST /api/vendors/[id]/reject error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
