// @ts-nocheck
// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { captureApiError } from "@/lib/error-handler";
import { errorResponse } from "@/lib/error-response";
import { withOrgContext } from "@/lib/org-context";
import { updateExpenseSchema } from "@/lib/validations/expense";
import { NextResponse } from "next/server";

const ROUTE_PATCH = "api/expenses/[id]:PATCH";
const ROUTE_DELETE = "api/expenses/[id]:DELETE";

// GET /api/expenses/[id] -- return single expense with all relations
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    return withOrgContext(
      { kind: "session", organizationId, userId, role },
      async () => {
    const { id } = await params;

    const where: Record<string, unknown> = { id, archivedAt: null };

    if (role === "beneficiary") {
      where.requestedById = userId;
      where.grant = { is: { organizationId } };
    } else if (role === "nonprofit_admin" || role === "cpa") {
      where.grant = { is: { organizationId } };
    } else if (role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const expense = await prisma.expenseRequest.findFirst({
      where,
      include: {
        grant: { select: { id: true, name: true, remainingAmount: true, organizationId: true } },
        category: { select: { id: true, name: true, allocatedAmount: true, spentAmount: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        vendor: { select: { id: true, name: true, type: true } },
        virtualCards: { select: { id: true, last4: true, status: true } },
        approvals: {
          select: { id: true, action: true, notes: true, createdAt: true, approverId: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json(expense);
      },
    );
  } catch (error) {
    captureApiError(error, { route: "GET /api/expenses/[id]" });
    console.error("GET /api/expenses/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/expenses/[id] -- update expense (only if PENDING)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId, organizationId } = session.user;

    if (role !== "beneficiary" && role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return withOrgContext(
      { kind: "session", organizationId, userId, role },
      async () => {
    const { id } = await params;

    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Find the expense and verify org scope + PENDING status
    const whereClause: Record<string, unknown> = {
      id,
      status: "PENDING",
      archivedAt: null,
      grant: { organizationId },
    };

    // Beneficiaries can only edit their own expenses
    if (role === "beneficiary") {
      whereClause.requestedById = userId;
    }

    const expense = await prisma.expenseRequest.findFirst({
      where: whereClause,
      include: {
        grant: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Expense not found, not pending, or not authorized" },
        { status: 404 },
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.amount !== undefined) {
      updateData.amount = data.amount;
    }
    if (data.categoryId !== undefined) {
      updateData.categoryId = data.categoryId;
    }
    if (data.vendorName !== undefined) {
      updateData.vendorName = data.vendorName || null;
    }

    const oldValues: Record<string, unknown> = {};
    if (data.description !== undefined) oldValues.description = expense.description;
    if (data.amount !== undefined) oldValues.amount = expense.amount.toString();
    if (data.categoryId !== undefined) oldValues.categoryId = expense.categoryId;
    if (data.vendorName !== undefined) oldValues.vendorName = expense.vendorName;

    const updatedExpense = await prisma.expenseRequest.update({
      where: { id },
      data: updateData,
      include: {
        grant: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        vendor: { select: { id: true, name: true, type: true } },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "update",
        entityType: "expense",
        entityId: id,
        oldValue: oldValues,
        newValue: updateData,
      },
    });

    return NextResponse.json(updatedExpense);
      },
    );
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
    captureApiError(error, { route: "PATCH /api/expenses/[id]" });
    console.error("PATCH /api/expenses/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/expenses/[id] -- soft delete (set archivedAt, only if PENDING)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId, organizationId } = session.user;

    if (role !== "beneficiary" && role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return withOrgContext(
      { kind: "session", organizationId, userId, role },
      async () => {
    const { id } = await params;

    // Find the expense and verify org scope + PENDING status
    const whereClause: Record<string, unknown> = {
      id,
      status: "PENDING",
      archivedAt: null,
      grant: { organizationId },
    };

    // Beneficiaries can only delete their own expenses
    if (role === "beneficiary") {
      whereClause.requestedById = userId;
    }

    const expense = await prisma.expenseRequest.findFirst({
      where: whereClause,
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Expense not found, not pending, or not authorized" },
        { status: 404 },
      );
    }

    // Soft delete
    await prisma.expenseRequest.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "delete",
        entityType: "expense",
        entityId: id,
        oldValue: {
          description: expense.description,
          amount: expense.amount.toString(),
          status: expense.status,
        },
        newValue: { archivedAt: new Date().toISOString() },
      },
    });

    return NextResponse.json({ success: true });
      },
    );
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
    captureApiError(error, { route: "DELETE /api/expenses/[id]" });
    console.error("DELETE /api/expenses/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
