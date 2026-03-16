// POST /api/vendors/[id]/approve — ORG-SCOPED

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
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

    const vendor = await prisma.vendor.findFirst({
      where: { id, organizationId, archivedAt: null },
      select: { id: true, name: true, status: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
      select: { id: true, name: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
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
    console.error("POST /api/vendors/[id]/approve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
