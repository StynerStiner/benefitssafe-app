// ORG-SCOPED vendor detail + update
// GET   /api/vendors/[id]
// PATCH /api/vendors/[id]

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateVendorSchema } from "@/lib/validations/vendor";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { organizationId } = session.user;

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

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Calculate total paid
    const totalPaid = vendor.expenses
      .filter((e) => e.status === "PAID" || e.status === "APPROVED")
      .reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);

    const lastTransaction = vendor.expenses[0]?.createdAt || null;

    return NextResponse.json({
      ...vendor,
      totalPaid: totalPaid.toFixed(2),
      lastTransaction,
    });
  } catch (error) {
    console.error("GET /api/vendors/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = await request.json();
    const parsed = updateVendorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const existing = await prisma.vendor.findFirst({
      where: { id, organizationId, archivedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const updated = await prisma.vendor.update({
      where: { id },
      data: parsed.data as never,
      select: { id: true, name: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId,
        action: "update",
        entityType: "vendor",
        entityId: id,
        newValue: JSON.parse(JSON.stringify(parsed.data)),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/vendors/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const existing = await prisma.vendor.findFirst({
      where: { id, organizationId, archivedAt: null },
      select: { id: true, name: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    await prisma.vendor.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
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
    console.error("DELETE /api/vendors/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
