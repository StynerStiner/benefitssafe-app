// @ts-nocheck
// POST /api/jobs/process-charge — Async processing of Stripe card charges
// Called by QStash queue after webhook receives the event.

import { prisma, retryOnSerializationFailure } from "@/lib/db";
import { classifyExpense } from "@/utils/compliance-rules";
import { shouldAutoApprove } from "@/lib/auto-approve";
import { errorResponse } from "@/lib/error-response";
import { verifyJobAuth, claimJobMessage } from "@/lib/queue";
import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";

const ROUTE = "api/jobs/process-charge:POST";

// Structured error for grant-balance failures inside the auto-approve
// $transaction. The outer catch maps this to a terminal 200 (not 500)
// so QStash does not retry a charge that will never succeed.
class InsufficientFundsError extends Error {
  constructor(public readonly code: string, public readonly detail: string) {
    super(detail);
  }
}

export async function POST(request: Request) {
  const auth = await verifyJobAuth(request);
  if (!auth.valid) {
    return errorResponse({
      kind: "unauthorized",
      message: "Unauthorized",
      route: ROUTE,
      method: "POST",
      userId: "system",
    });
  }
  // Ch8 messageId-level dedup as a belt-and-braces with the existing
  // Ch7 txRecord.expenseId + ledger reference guards below.
  const first = await claimJobMessage(auth.messageId);
  if (!first) {
    return NextResponse.json({ deduped: "message_id", messageId: auth.messageId });
  }

  try {
    const { data } = await request.json();
    const { transactionId } = data;

    if (!transactionId) {
      return errorResponse({
        kind: "validation",
        message: "Missing transactionId",
        route: ROUTE,
        method: "POST",
        userId: "system",
      });
    }

    // 1. Load the transaction
    const txRecord = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        card: {
          include: {
            expense: { select: { grantId: true } },
          },
        },
      },
    });

    if (!txRecord) {
      return errorResponse({
        kind: "not_found",
        message: "Transaction not found",
        route: ROUTE,
        method: "POST",
        userId: "system",
        extraBody: { transactionId },
      });
    }

    const { organizationId, merchantName, amount, merchantCategory } = txRecord;
    const virtualCard = txRecord.card;
    const stripeTransactionId = txRecord.stripeTransactionId;

    // 2. Check for linked subscription
    const subscription = await prisma.subscription.findFirst({
      where: { cardId: virtualCard.id, status: "ACTIVE" },
      include: { vendor: { select: { id: true, name: true, type: true } } },
    });

    // Resolve grantId
    const grantId = subscription?.grantId ?? virtualCard.expense?.grantId ?? txRecord.grantId;
    if (!grantId) {
      return errorResponse({
        kind: "validation",
        message: "No grant linked",
        route: ROUTE,
        method: "POST",
        userId: "system",
        organizationId,
        status: 422,
        extraBody: { transactionId },
      });
    }

    // 3. Load grant
    const grant = await prisma.grant.findUnique({
      where: { id: grantId },
      select: {
        id: true,
        organizationId: true,
        beneficiaryId: true,
        spentAmount: true,
        remainingAmount: true,
        benefitFlags: true,
      },
    });

    if (!grant || grant.organizationId !== organizationId) {
      return errorResponse({
        kind: "validation",
        message: "Grant not found or org mismatch",
        route: ROUTE,
        method: "POST",
        userId: "system",
        organizationId,
        status: 422,
        extraBody: { transactionId, grantId },
      });
    }

    // 3a. Retry idempotency guard. QStash delivers-at-least-once, so a
    //     retried job (or a concurrent delivery) must not double-create
    //     the expense or double-debit the grant. If any LedgerEntry
    //     already references this stripeTransactionId OR the Transaction
    //     already has an expenseId set, this job already ran — return 200
    //     so QStash stops retrying. (DDIA Ch7 Transaction Safety audit.)
    if (txRecord.expenseId) {
      return NextResponse.json({
        success: true,
        expenseId: txRecord.expenseId,
        deduped: "already_linked",
      });
    }
    const existingLedger = await prisma.ledgerEntry.findFirst({
      where: { reference: stripeTransactionId },
      select: { id: true, expenseId: true },
    });
    if (existingLedger) {
      return NextResponse.json({
        success: true,
        expenseId: existingLedger.expenseId,
        deduped: "ledger_exists",
      });
    }

    // 4. Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { organizationId, role: "nonprofit_admin" },
      select: { id: true },
    });
    const systemUserId = adminUser?.id ?? "system";

    // 5. Create ExpenseRequest + link Transaction atomically.
    //    The create + transaction-link must be in one tx so a crash
    //    between them cannot orphan the Transaction from its expense.
    const categoryId = subscription?.categoryId ?? virtualCard.categoryId;
    const expenseDescription = subscription
      ? `Auto-generated: ${subscription.vendor?.name ?? merchantName} subscription charge`
      : `Auto-generated: ${merchantName} card charge`;

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expenseRequest.create({
        data: {
          organizationId,
          grantId,
          categoryId: categoryId ?? null,
          requestedById: grant.beneficiaryId ?? systemUserId,
          vendorId: subscription?.vendorId ?? virtualCard.vendorId ?? null,
          description: expenseDescription,
          amount: Number(amount),
          frequency: subscription ? "MONTHLY" : "ONE_TIME",
          expenseType: subscription ? "subscription" : "purchase",
          vendorName: subscription?.vendor?.name ?? merchantName,
          riskClassification: "PENDING",
          status: "PENDING",
        },
      });

      // Status-guarded link so a concurrent retry that already linked
      // the transaction to another expense short-circuits cleanly.
      const linked = await tx.transaction.updateMany({
        where: { id: transactionId, expenseId: null },
        data: { expenseId: created.id },
      });
      if (linked.count === 0) {
        // Another delivery already linked this transaction — roll back
        // our expense and let the outer handler retry-read the canonical row.
        throw new Error("transaction_already_linked");
      }

      return created;
    });

    // 6. Compliance classification
    const benefitFlags = grant.benefitFlags as {
      ssi: boolean; ssdi: boolean; mediCal: boolean; medicaid: boolean; able: boolean;
    } | null;

    const classification = classifyExpense(
      {
        expenseType: expense.expenseType,
        description: expense.description,
        vendorType: subscription?.vendor?.type ?? "ONE_TIME_VENDOR",
        amount: Number(amount),
        category: categoryId ?? "uncategorized",
        frequency: expense.frequency,
      },
      benefitFlags,
    );

    await prisma.expenseRequest.update({
      where: { id: expense.id },
      data: {
        riskClassification: classification.level,
        riskNotes: classification.reason,
      },
    });

    // 7. Auto-approval check
    const autoApproveResult = await shouldAutoApprove({
      organizationId,
      amount: Number(amount),
      riskClassification: classification.level,
      categoryId: categoryId ?? undefined,
    });

    if (autoApproveResult.approved) {
      // Atomic conditional approve with Serializable isolation.
      // The FOR UPDATE lock serializes concurrent access; the WHERE
      // remainingAmount >= amount guard prevents the balance from going
      // negative. Without the WHERE, Prisma's { decrement } happily
      // drives the balance below zero. (DDIA Ch12 audit — C-2 fix.)
      await retryOnSerializationFailure(() =>
        prisma.$transaction(async (tx) => {
        // Lock grant row (belt-and-suspenders with Serializable)
        await tx.$queryRaw`
          SELECT id FROM "Grant"
          WHERE id = ${grantId}
          FOR UPDATE
        `;

        // Atomic conditional decrement with RETURNING so the UPDATE
        // and the balance read are a single round-trip. Zero rows
        // returned means the grant cannot cover this charge.
        const result = await tx.$queryRaw<{ remainingAmount: Prisma.Decimal }[]>`
          UPDATE "Grant"
          SET "spentAmount"     = "spentAmount"     + ${Number(amount)}::numeric,
              "remainingAmount" = "remainingAmount" - ${Number(amount)}::numeric,
              "updatedAt"       = NOW()
          WHERE id = ${grantId}
            AND "remainingAmount" >= ${Number(amount)}::numeric
          RETURNING "remainingAmount"
        `;
        if (result.length === 0) {
          throw new InsufficientFundsError(
            "insufficient_grant_funds",
            `Grant ${grantId} has insufficient funds for auto-approve of $${Number(amount).toFixed(2)}`,
          );
        }

        await tx.expenseRequest.update({
          where: { id: expense.id },
          data: { status: "APPROVED", approvedById: systemUserId, approvedAt: new Date() },
        });

        await tx.ledgerEntry.create({
          data: {
            organizationId,
            grantId,
            categoryId: categoryId ?? null,
            expenseId: expense.id,
            type: "DEBIT",
            amount: Number(amount),
            balanceAfter: result[0].remainingAmount,
            description: `Auto-approved: ${merchantName} ($${Number(amount).toFixed(2)})`,
            reference: stripeTransactionId,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: systemUserId,
            organizationId,
            action: "auto_approve",
            entityType: "expense",
            entityId: expense.id,
            newValue: {
              amount: Number(amount),
              merchantName,
              riskClassification: classification.level,
              autoApproveReason: autoApproveResult.reason,
              stripeTransactionId,
            },
          },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      }),
      );

      if (adminUser) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            organizationId,
            type: "expense_auto_approved",
            title: "Expense auto-approved",
            message: `$${Number(amount).toFixed(2)} charge from ${merchantName} was auto-approved (${classification.level}).`,
            entityType: "expense",
            entityId: expense.id,
            href: "/expenses",
          },
        });
      }
    } else {
      await prisma.auditLog.create({
        data: {
          userId: systemUserId,
          organizationId,
          action: "auto_create_pending",
          entityType: "expense",
          entityId: expense.id,
          newValue: {
            amount: Number(amount),
            merchantName,
            riskClassification: classification.level,
            autoApproveDeclined: autoApproveResult.reason,
            stripeTransactionId,
          },
        },
      });

      if (adminUser) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            organizationId,
            type: "expense_submitted",
            title: "New expense requires review",
            message: `$${Number(amount).toFixed(2)} charge from ${merchantName} needs manual review (${classification.level}).`,
            entityType: "expense",
            entityId: expense.id,
            href: "/expenses",
          },
        });
      }
    }

    return NextResponse.json({ success: true, expenseId: expense.id });
  } catch (error) {
    // Insufficient grant funds — terminal failure, not transient. Mark
    // the charge as declined and the expense as rejected so the admin
    // dashboard shows what happened. Return 200 so QStash stops retrying.
    if (error instanceof InsufficientFundsError) {
      console.warn(`[process-charge] ${error.detail}`);
      try {
        await prisma.transaction.updateMany({
          where: { id: transactionId, status: { not: "declined" } },
          data: { status: "declined", declinedReason: "Insufficient grant funds" },
        });
        await prisma.expenseRequest.update({
          where: { id: expense.id },
          data: { status: "REJECTED", rejectedReason: "Insufficient grant funds (auto-rejected)" },
        });
        await prisma.auditLog.create({
          data: {
            userId: systemUserId,
            organizationId,
            action: "auto_reject",
            entityType: "expense",
            entityId: expense.id,
            newValue: {
              reason: error.detail,
              stripeTransactionId,
            },
          },
        });
      } catch (cleanupErr) {
        console.error("[process-charge] cleanup after insufficient funds failed:", cleanupErr);
      }
      return NextResponse.json({ success: false, code: error.code, detail: error.detail });
    }

    // transaction_already_linked is the idempotency guard: a concurrent
    // retry won the race. Treat as success so QStash stops retrying.
    if ((error as Error)?.message === "transaction_already_linked") {
      console.log("[process-charge] dedupe: transaction already linked");
      return NextResponse.json({ success: true, deduped: "race_loser" });
    }

    return errorResponse({
      kind: "internal",
      message: "Processing failed",
      route: ROUTE,
      method: "POST",
      userId: "system",
      cause: error,
    });
  }
}
