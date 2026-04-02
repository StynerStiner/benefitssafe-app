// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { captureApiError } from "@/lib/error-handler";
import { rejectExpenseSchema } from "@/lib/validations/expense";
import { NextResponse } from "next/server";

// PATCH /api/expenses/[id]/reject — reject an expense request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId, organizationId } = session.user;

    // Only nonprofit admins and platform admins can reject
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const body = await request.json();
    const parsed = rejectExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Find the expense and verify org scope
    const expense = await prisma.expenseRequest.findFirst({
      where: {
        id,
        grant: { organizationId },
        status: "PENDING",
      },
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Expense not found or not pending" },
        { status: 404 },
      );
    }

    // Update expense status
    const updatedExpense = await prisma.expenseRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedReason: parsed.data.reason,
      },
      include: {
        grant: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Create approval record (tracks rejections too)
    await prisma.approval.create({
      data: {
        expenseId: id,
        approverId: userId,
        action: "REJECTED",
        notes: parsed.data.notes ?? parsed.data.reason,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "reject",
        entityType: "expense",
        entityId: id,
        oldValue: { status: "PENDING" },
        newValue: {
          status: "REJECTED",
          rejectedReason: parsed.data.reason,
        },
      },
    });

    // Notify the beneficiary who submitted the expense
    if (updatedExpense.requestedBy) {
      await prisma.notification.create({
        data: {
          userId: updatedExpense.requestedBy.id,
          organizationId,
          type: "expense_rejected",
          title: "Expense request rejected",
          message: `Your expense for "${updatedExpense.description}" (${updatedExpense.grant.name}) was rejected. Reason: ${parsed.data.reason}`,
          entityType: "expense",
          entityId: id,
          href: `/expenses`,
        },
      });
    }

    return NextResponse.json(updatedExpense);
  } catch (error) {
    captureApiError(error, { route: "PATCH /api/expenses/[id]/reject" });
    console.error("PATCH /api/expenses/[id]/reject error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
