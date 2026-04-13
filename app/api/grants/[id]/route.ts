// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { updateGrantSchema } from "@/lib/validations/grant";
import { NextResponse } from "next/server";

// GET /api/grants/[id] — get single grant with categories and expenses
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { organizationId, role } = session.user;

    // Vendors never see grant detail — they have no business touching other
    // people's compliance rules or cards.
    if (role === "vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const grant = await prisma.grant.findFirst({
      where: {
        id,
        organizationId,
        ...(role === "beneficiary" ? { beneficiaryId: session.user.id } : {}),
      },
      include: {
        beneficiary: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: {
          orderBy: { createdAt: "asc" },
        },
        expenses: {
          include: {
            category: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        virtualCards: {
          include: {
            beneficiary: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                memberships: {
                  where: { organizationId },
                  select: { memberCode: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    return NextResponse.json(grant);
  } catch (error) {
    console.error("GET /api/grants/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/grants/[id] — update a grant
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { role, organizationId, id: userId } = session.user;

    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify grant belongs to org
    const existing = await prisma.grant.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateGrantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If totalAmount changed, recalculate remaining
    const updateData: Record<string, unknown> = { ...data };
    if (data.totalAmount !== undefined) {
      const spent = Number(existing.spentAmount);
      updateData.remainingAmount = data.totalAmount - spent;
    }

    // Handle soft delete via ARCHIVED status
    if (data.status === "ARCHIVED") {
      updateData.archivedAt = new Date();
    }

    const grant = await prisma.grant.update({
      where: { id },
      data: updateData,
      include: {
        beneficiary: { select: { id: true, firstName: true, lastName: true, email: true } },
        categories: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "update",
        entityType: "grant",
        entityId: grant.id,
        oldValue: { name: existing.name, status: existing.status },
        newValue: { name: grant.name, status: grant.status },
      },
    });

    return NextResponse.json(grant);
  } catch (error) {
    console.error("PATCH /api/grants/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
