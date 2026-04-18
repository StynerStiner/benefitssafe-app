// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { sendEmail } from "@/lib/services/email-service";
import { buildExpenseRejectedEmail } from "@/lib/services/email-templates";
import { rejectExpenseSchema } from "@/lib/validations/expense";
import { NextResponse } from "next/server";

const ROUTE = "api/expenses/[id]/reject:PATCH";

// PATCH /api/expenses/[id]/reject — reject an expense request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse({
        kind: "unauthorized",
        message: "Unauthorized",
        route: ROUTE,
        method: "PATCH",
      });
    }

    const { role, id: userId, organizationId } = session.user;

    // Only nonprofit admins and platform admins can reject
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return errorResponse({
        kind: "forbidden",
        message: "Forbidden",
        route: ROUTE,
        method: "PATCH",
        userId,
        organizationId,
      });
    }

    const { id } = await params;

    const body = await request.json();
    const parsed = rejectExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse({
        kind: "validation",
        message: "Validation failed",
        route: ROUTE,
        method: "PATCH",
        userId,
        organizationId,
        extraBody: { details: parsed.error.flatten() },
      });
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
      return errorResponse({
        kind: "not_found",
        message: "Expense not found or not pending",
        route: ROUTE,
        method: "PATCH",
        userId,
        organizationId,
      });
    }

    // All mutations in a single transaction for consistency. The status
    // transition uses updateMany WHERE status='PENDING' + rowCount
    // check so an approve/reject race (or a retried reject after a
    // concurrent approve committed) fails loudly instead of silently
    // flipping an already-approved expense to REJECTED.
    // (DDIA Ch7 Transaction Safety audit — lost update prevention.)
    let updatedExpense;
    try {
      updatedExpense = await prisma.$transaction(async (tx) => {
        const statusFlip = await tx.expenseRequest.updateMany({
          where: { id, status: "PENDING" },
          data: {
            status: "REJECTED",
            rejectedReason: parsed.data.reason,
          },
        });
        if (statusFlip.count === 0) {
          throw new Error("expense_not_pending_at_commit");
        }

        const fresh = await tx.expenseRequest.findUniqueOrThrow({
          where: { id },
          include: {
            grant: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        });

        // Create approval record (tracks rejections too)
        await tx.approval.create({
          data: {
            organizationId,
            expenseId: id,
            approverId: userId,
            action: "REJECTED",
            notes: parsed.data.notes ?? parsed.data.reason,
          },
        });

        // Create audit log inside the tx so it rolls back on conflict.
        await tx.auditLog.create({
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

        return fresh;
      });
    } catch (err) {
      if ((err as Error)?.message === "expense_not_pending_at_commit") {
        return errorResponse({
          kind: "conflict",
          message: "Expense is no longer pending",
          route: ROUTE,
          method: "PATCH",
          userId,
          organizationId,
          cause: err,
        });
      }
      throw err;
    }

    // Notify the beneficiary who submitted the expense (in-app + email)
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

      // Fire-and-forget email — notification already persisted.
      if (updatedExpense.requestedBy.email) {
        const baseUrl = process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";
        const amountStr = `$${Number(updatedExpense.amount).toFixed(2)}`;
        const tmpl = buildExpenseRejectedEmail({
          firstName: updatedExpense.requestedBy.firstName || "there",
          orgName: session.user.organizationName,
          expenseDescription: updatedExpense.description,
          amount: amountStr,
          grantName: updatedExpense.grant.name,
          decisionUrl: `${baseUrl}/expenses`,
          notes: parsed.data.reason,
        });
        sendEmail({
          to: updatedExpense.requestedBy.email,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
          orgName: session.user.organizationName,
          userId: updatedExpense.requestedBy.id,
          organizationId,
          emailType: "expense_rejected",
        }).catch((err) => console.error("[expense_rejected email] failed:", err));
      }
    }

    return NextResponse.json(updatedExpense);
  } catch (error) {
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE,
      method: "PATCH",
      cause: error,
    });
  }
}
