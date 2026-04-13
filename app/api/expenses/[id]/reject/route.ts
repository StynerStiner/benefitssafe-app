// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { captureApiError } from "@/lib/error-handler";
import { sendEmail } from "@/lib/services/email-service";
import { buildExpenseRejectedEmail } from "@/lib/services/email-templates";
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

    // All mutations in a single transaction for consistency
    const updatedExpense = await prisma.$transaction(async (tx) => {
      // Update expense status
      const expense = await tx.expenseRequest.update({
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
      await tx.approval.create({
        data: {
          organizationId,
          expenseId: id,
          approverId: userId,
          action: "REJECTED",
          notes: parsed.data.notes ?? parsed.data.reason,
        },
      });

      // Create audit log
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

      return expense;
    });

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
    captureApiError(error, { route: "PATCH /api/expenses/[id]/reject" });
    console.error("PATCH /api/expenses/[id]/reject error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
