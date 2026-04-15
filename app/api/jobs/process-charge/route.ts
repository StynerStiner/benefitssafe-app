// @ts-nocheck
// POST /api/jobs/process-charge — Async processing of Stripe card charges
// Called by QStash queue after webhook receives the event.

import { prisma } from "@/lib/db";
import { classifyExpense } from "@/utils/compliance-rules";
import { shouldAutoApprove } from "@/lib/auto-approve";
import { verifyJobAuth } from "@/lib/queue";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!verifyJobAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data } = await request.json();
    const { transactionId } = data;

    if (!transactionId) {
      return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
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
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
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
      console.error(`[process-charge] No grantId for tx ${transactionId}`);
      return NextResponse.json({ error: "No grant linked" }, { status: 422 });
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
      console.error(`[process-charge] Grant mismatch for tx ${transactionId}`);
      return NextResponse.json({ error: "Grant not found or org mismatch" }, { status: 422 });
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
      // Use transaction with row-level lock to prevent concurrent overspend
      await prisma.$transaction(async (tx) => {
        // Lock grant row
        await tx.$queryRaw`
          SELECT id FROM "Grant"
          WHERE id = ${grantId}
          FOR UPDATE
        `;

        const updatedGrant = await tx.grant.update({
          where: { id: grantId },
          data: {
            spentAmount: { increment: Number(amount) },
            remainingAmount: { decrement: Number(amount) },
          },
        });

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
            balanceAfter: updatedGrant.remainingAmount,
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
      });

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
    // transaction_already_linked is the idempotency guard: a concurrent
    // retry won the race. Treat as success so QStash stops retrying.
    if ((error as Error)?.message === "transaction_already_linked") {
      console.log("[process-charge] dedupe: transaction already linked");
      return NextResponse.json({ success: true, deduped: "race_loser" });
    }
    console.error("[process-charge] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
