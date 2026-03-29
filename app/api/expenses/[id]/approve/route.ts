// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { captureApiError } from "@/lib/error-handler";
import { approveExpenseSchema } from "@/lib/validations/expense";
import { NextResponse } from "next/server";

// PATCH /api/expenses/[id]/approve — approve an expense request
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

    // Only nonprofit admins and platform admins can approve
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const body = await request.json();
    const parsed = approveExpenseSchema.safeParse(body);

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
      include: {
        grant: true,
        category: true,
      },
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Expense not found or not pending" },
        { status: 404 },
      );
    }

    const amount = Number(expense.amount);

    // Check if grant has sufficient remaining funds
    const grantRemaining = Number(expense.grant.remainingAmount);
    if (amount > grantRemaining) {
      return NextResponse.json(
        { error: "Insufficient grant funds. Remaining: $" + grantRemaining.toFixed(2) },
        { status: 400 },
      );
    }

    // Check if budget category has sufficient funds
    const categoryRemaining =
      Number(expense.category.allocatedAmount) - Number(expense.category.spentAmount);
    if (amount > categoryRemaining) {
      return NextResponse.json(
        {
          error:
            "Insufficient budget category funds. Remaining: $" +
            categoryRemaining.toFixed(2),
        },
        { status: 400 },
      );
    }

    // Perform all updates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update expense status
      const updatedExpense = await tx.expenseRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: userId,
          approvedAt: new Date(),
        },
        include: {
          grant: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      // 2. Update grant spent/remaining amounts
      await tx.grant.update({
        where: { id: expense.grantId },
        data: {
          spentAmount: { increment: amount },
          remainingAmount: { decrement: amount },
        },
      });

      // 3. Update budget category spent amount
      await tx.budgetCategory.update({
        where: { id: expense.categoryId },
        data: {
          spentAmount: { increment: amount },
        },
      });

      // 4. Create ledger entry (IMMUTABLE — append only)
      const newGrantRemaining = grantRemaining - amount;
      await tx.ledgerEntry.create({
        data: {
          grantId: expense.grantId,
          categoryId: expense.categoryId,
          expenseId: expense.id,
          type: "DEBIT",
          amount: amount,
          balanceAfter: newGrantRemaining,
          description: `Approved: ${expense.description}`,
          reference: expense.id,
        },
      });

      // 5. Create approval record
      await tx.approval.create({
        data: {
          expenseId: expense.id,
          approverId: userId,
          action: "APPROVED",
          notes: parsed.data.notes ?? null,
        },
      });

      return updatedExpense;
    });

    // Create audit log (outside transaction — non-critical)
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "approve",
        entityType: "expense",
        entityId: id,
        oldValue: { status: "PENDING" },
        newValue: {
          status: "APPROVED",
          approvedById: userId,
          amount: amount.toString(),
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    captureApiError(error, { route: "PATCH /api/expenses/[id]/approve" });
    console.error("PATCH /api/expenses/[id]/approve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
