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

    // Pre-check org scope before opening the tx. The canonical spentAmount
    // is re-read INSIDE the tx below with SELECT FOR UPDATE so a
    // concurrent auto-approve charge cannot clobber remainingAmount.
    // (DDIA Ch7 Transaction Safety audit.)
    const exists = await prisma.grant.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!exists) {
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

    // Wrap the read + recompute + update in a single tx with FOR UPDATE
    // on the grant row. Without the lock, a concurrent card-charge or
    // auto-approve tx could increment spentAmount between our read and
    // our update, causing the re-computed remainingAmount to be wrong.
    const grant = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ spentAmount: number; name: string; status: string }>
      >`
        SELECT "spentAmount", "name", "status"
        FROM "Grant"
        WHERE id = ${id}
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new Error("grant_not_found");
      }
      const currentSpent = Number(locked[0].spentAmount);

      const updateData: Record<string, unknown> = { ...data };
      if (data.totalAmount !== undefined) {
        // Recompute remaining from the locked snapshot so a concurrent
        // spent-amount increment can't produce an inconsistent result.
        updateData.remainingAmount = data.totalAmount - currentSpent;
      }
      if (data.status === "ARCHIVED") {
        updateData.archivedAt = new Date();
      }

      const updated = await tx.grant.update({
        where: { id },
        data: updateData,
        include: {
          beneficiary: { select: { id: true, firstName: true, lastName: true, email: true } },
          categories: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          organizationId,
          action: "update",
          entityType: "grant",
          entityId: updated.id,
          oldValue: { name: locked[0].name, status: locked[0].status },
          newValue: { name: updated.name, status: updated.status },
        },
      });

      return updated;
    });

    return NextResponse.json(grant);
  } catch (error) {
    if ((error as Error)?.message === "grant_not_found") {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }
    console.error("PATCH /api/grants/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
