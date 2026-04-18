// ORG-SCOPED: All queries filtered by session.user.organizationId
// No cross-organization data leakage possible.
//
// TRANSACTION SAFETY (DDIA Ch7 audit):
//   - Grant + BudgetCategory decrements use atomic conditional UPDATEs
//     (WHERE remainingAmount >= amount) instead of read-modify-write,
//     so two concurrent approvals on the same grant cannot both pass a
//     JS balance check and end up overspending.
//   - Expense status transition uses updateMany WHERE status = 'PENDING'
//     with a rowCount check so a retried approval can't run twice.
//   - balanceAfter on the ledger entry is read from the post-update grant
//     row inside the same tx, not computed from a stale pre-tx read.
//   - $transaction runs at Serializable isolation as belt-and-suspenders.
//   - Audit log insert lives INSIDE the $transaction so it only persists
//     when the approval actually commits.

import { auth } from "@/auth";
import { prisma, retryOnSerializationFailure } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { errorResponse } from "@/lib/error-response";
import { invalidateDashboardCache } from "@/lib/data";
import { sendEmail } from "@/lib/services/email-service";
import { buildExpenseApprovedEmail } from "@/lib/services/email-templates";
import { approveExpenseSchema } from "@/lib/validations/expense";
import { NextResponse } from "next/server";

const ROUTE = "api/expenses/[id]/approve:PATCH";

// Sentinel error classes so the $transaction body can reject with
// structured reasons and the outer handler can map them to HTTP codes
// without leaking internals.
class ApprovalConflictError extends Error {
  constructor(public readonly code: string, public readonly detail: string) {
    super(detail);
  }
}

// PATCH /api/expenses/[id]/approve — approve an expense request
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

    // Only nonprofit admins and platform admins can approve
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
    const parsed = approveExpenseSchema.safeParse(body);

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

    // Pre-fetch expense for org-scope check and to surface the current
    // amount/category before opening the transaction. Any race-sensitive
    // invariants are re-verified inside the tx via conditional UPDATEs.
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
      return errorResponse({
        kind: "not_found",
        message: "Expense not found or not pending",
        route: ROUTE,
        method: "PATCH",
        userId,
        organizationId,
      });
    }

    const amount = Number(expense.amount);

    // Perform all money-mutating writes in a Serializable transaction.
    // Serializable is the strongest isolation — rare conflicts retry,
    // the contention set is bounded to rows in the same grant, and the
    // correctness gain (no write skew, no lost update) is worth it.
    //
    // DDIA Ch8 — wrapped in retryOnSerializationFailure so Postgres
    // 40001 / P2034 write-conflict aborts retry up to 3 times with
    // exponential backoff. Without this, every contended approval
    // returns 500 to the user, which defeats the point of Serializable.
    let result;
    try {
      result = await retryOnSerializationFailure(() =>
        prisma.$transaction(
        async (tx) => {
          // 1. Atomic status guard — reject if already approved/rejected by
          //    a concurrent request. updateMany returns count; we throw on
          //    count=0 so the tx rolls back and the retried request sees
          //    the terminal state.
          const statusUpdate = await tx.expenseRequest.updateMany({
            where: { id, status: "PENDING" },
            data: {
              status: "APPROVED",
              approvedById: userId,
              approvedAt: new Date(),
            },
          });
          if (statusUpdate.count === 0) {
            throw new ApprovalConflictError(
              "already_processed",
              "Expense is no longer pending",
            );
          }

          // 2. Atomic conditional decrement on Grant.
          //    Prisma's `{ decrement: amount }` alone is safe from
          //    lost-updates on the column value (it compiles to
          //    `SET remainingAmount = remainingAmount - $1`) but it is
          //    NOT conditional — it will happily go negative. The raw
          //    SQL UPDATE below adds `WHERE remainingAmount >= $amount`
          //    so two concurrent approvals cannot both succeed against a
          //    grant that can only cover one.
          const grantUpdated = await tx.$executeRaw`
            UPDATE "Grant"
            SET "spentAmount"     = "spentAmount"     + ${amount}::numeric,
                "remainingAmount" = "remainingAmount" - ${amount}::numeric,
                "updatedAt"       = NOW()
            WHERE id = ${expense.grantId}
              AND "remainingAmount" >= ${amount}::numeric
          `;
          if (grantUpdated === 0) {
            throw new ApprovalConflictError(
              "insufficient_grant_funds",
              "Insufficient grant funds at approval time",
            );
          }

          // 3. Atomic conditional decrement on BudgetCategory. Same
          //    invariant: allocated - spent must stay >= amount.
          const categoryUpdated = await tx.$executeRaw`
            UPDATE "BudgetCategory"
            SET "spentAmount" = "spentAmount" + ${amount}::numeric,
                "updatedAt"   = NOW()
            WHERE id = ${expense.categoryId}
              AND ("allocatedAmount" - "spentAmount") >= ${amount}::numeric
          `;
          if (categoryUpdated === 0) {
            throw new ApprovalConflictError(
              "insufficient_category_funds",
              "Insufficient budget category funds at approval time",
            );
          }

          // 4. Re-read the post-update grant balance for the ledger entry
          //    so balanceAfter matches what's actually in the grant row
          //    right now (not a stale pre-tx snapshot).
          const updatedGrant = await tx.grant.findUnique({
            where: { id: expense.grantId },
            select: { remainingAmount: true },
          });

          // 5. Create immutable ledger entry (DEBIT)
          await tx.ledgerEntry.create({
            data: {
              organizationId: expense.grant.organizationId,
              grantId: expense.grantId,
              categoryId: expense.categoryId,
              expenseId: expense.id,
              type: "DEBIT",
              amount: amount,
              balanceAfter: updatedGrant?.remainingAmount ?? 0,
              description: `Approved: ${expense.description}`,
              reference: expense.id,
            },
          });

          // 6. Approval record
          await tx.approval.create({
            data: {
              organizationId,
              expenseId: expense.id,
              approverId: userId,
              action: "APPROVED",
              notes: parsed.data.notes ?? null,
            },
          });

          // 7. Audit log INSIDE the tx so it only commits when the
          //    approval actually commits. A forensic record of a
          //    *failed* attempt has no value here — the attempt never
          //    mutated state.
          await tx.auditLog.create({
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

          // 8. Re-read the updated expense for the response payload.
          //    We can't return the row from updateMany, so fetch it.
          return tx.expenseRequest.findUniqueOrThrow({
            where: { id },
            include: {
              grant: { select: { id: true, name: true, organizationId: true } },
              category: { select: { id: true, name: true } },
              requestedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        },
        ),
      );
    } catch (err) {
      if (err instanceof ApprovalConflictError) {
        const kind: "conflict" | "validation" | "internal" =
          err.code === "already_processed"
            ? "conflict"
            : err.code === "insufficient_grant_funds" ||
                err.code === "insufficient_category_funds"
              ? "validation"
              : "internal";
        return errorResponse({
          kind,
          message: err.detail,
          route: ROUTE,
          method: "PATCH",
          userId,
          organizationId,
          extraBody: { code: err.code },
          cause: err,
        });
      }
      throw err;
    }

    // Invalidate dashboard roll-up (same pattern as expense create)
    await invalidateDashboardCache(organizationId);

    // Fire workflow automation (non-blocking)
    import("@/lib/workflow-engine").then(({ getWorkflowEngine }) => {
      getWorkflowEngine().fire(organizationId, "expense_approved", {
        expenseId: id,
        beneficiaryName: `${result.requestedBy?.firstName || ""} ${result.requestedBy?.lastName || ""}`.trim(),
        beneficiaryEmail: result.requestedBy?.email || "",
        amount,
        category: result.category?.name || result.description || "",
        grantName: result.grant?.name || "",
        approvedBy: session.user?.name || "Admin",
      });
    }).catch(() => {});

    // Notify the beneficiary who submitted the expense (in-app + email)
    if (result.requestedBy) {
      await prisma.notification.create({
        data: {
          userId: result.requestedBy.id,
          organizationId,
          type: "expense_approved",
          title: "Expense request approved",
          message: `Your $${amount.toFixed(2)} expense for "${result.description}" (${result.grant.name}) has been approved.`,
          entityType: "expense",
          entityId: id,
          href: `/expenses`,
        },
      });

      // Fire-and-forget email — notification already persisted.
      if (result.requestedBy.email) {
        const baseUrl = process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";
        const tmpl = buildExpenseApprovedEmail({
          firstName: result.requestedBy.firstName || "there",
          orgName: session.user.organizationName,
          expenseDescription: result.description,
          amount: `$${amount.toFixed(2)}`,
          grantName: result.grant.name,
          decisionUrl: `${baseUrl}/expenses`,
        });
        sendEmail({
          to: result.requestedBy.email,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
          orgName: session.user.organizationName,
          userId: result.requestedBy.id,
          organizationId,
          emailType: "expense_approved",
        }).catch((err) => console.error("[expense_approved email] failed:", err));
      }
    }

    return NextResponse.json(result);
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
