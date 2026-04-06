// @ts-nocheck
// POST /api/webhooks/stripe-charges — Handle Stripe Issuing card transaction events
// This is SEPARATE from /api/webhooks/stripe-billing which handles subscription billing.

import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { classifyExpense } from "@/utils/compliance-rules";
import { shouldAutoApprove } from "@/lib/auto-approve";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export async function POST(request: Request) {
  let event: Stripe.Event;

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_CHARGES_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_CHARGES_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe charges webhook signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  // Only handle issuing transaction events
  if (event.type !== "issuing_transaction.created") {
    return NextResponse.json({ received: true });
  }

  try {
    const transaction = event.data.object as Stripe.Issuing.Transaction;
    const stripeCardId = transaction.card;
    const amount = Math.abs(transaction.amount) / 100; // Stripe amounts are in cents, and debits are negative
    const merchantName = transaction.merchant_data?.name ?? "Unknown Merchant";
    const merchantCategory = transaction.merchant_data?.category ?? "";
    const stripeTransactionId = transaction.id;

    // 1. Find our VirtualCard by Stripe card ID
    const virtualCard = await prisma.virtualCard.findUnique({
      where: { stripeCardId: typeof stripeCardId === 'string' ? stripeCardId : stripeCardId },
      include: {
        expense: {
          select: { grantId: true },
        },
      },
    });

    if (!virtualCard) {
      // Not our card — acknowledge and move on
      console.log(`Card charge on unknown card ${stripeCardId}, skipping`);
      return NextResponse.json({ received: true });
    }

    const { organizationId } = virtualCard;

    // 2. Check for an active Subscription linked to this card
    const subscription = await prisma.subscription.findFirst({
      where: {
        cardId: virtualCard.id,
        status: "ACTIVE",
      },
      include: {
        vendor: { select: { id: true, name: true, type: true } },
      },
    });

    // Resolve grantId: subscription takes priority, then expense link
    const grantId = subscription?.grantId ?? virtualCard.expense?.grantId;
    if (!grantId) {
      console.error(`Card charge on card ${virtualCard.id} but no grantId resolvable`);
      return NextResponse.json({ received: true });
    }

    // 3. Idempotency: check if we already processed this transaction
    const existingTx = await prisma.transaction.findUnique({
      where: { stripeTransactionId },
    });
    if (existingTx) {
      console.log(`Transaction ${stripeTransactionId} already processed, skipping`);
      return NextResponse.json({ received: true });
    }

    // 4. Load the grant with beneficiary benefit flags
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

    if (!grant) {
      console.error(`Grant ${grantId} not found for card charge`);
      return NextResponse.json({ received: true });
    }

    // Verify org match
    if (grant.organizationId !== organizationId) {
      console.error(`Org mismatch: card org ${organizationId} vs grant org ${grant.organizationId}`);
      return NextResponse.json({ received: true });
    }

    // 5. Find the first admin user for audit log attribution
    const adminUser = await prisma.user.findFirst({
      where: { organizationId, role: "nonprofit_admin" },
      select: { id: true },
    });
    const systemUserId = adminUser?.id ?? "system";

    // 6. Create Transaction record
    const txRecord = await prisma.transaction.create({
      data: {
        organizationId,
        cardId: virtualCard.id,
        stripeTransactionId,
        amount,
        merchantName,
        merchantCategory,
        status: "completed",
        grantId,
      },
    });

    // 7. Build and create ExpenseRequest
    const categoryId = subscription?.categoryId ?? virtualCard.categoryId;
    const expenseDescription = subscription
      ? `Auto-generated: ${subscription.vendor?.name ?? merchantName} subscription charge`
      : `Auto-generated: ${merchantName} card charge`;

    const expenseData = {
      grantId,
      categoryId: categoryId ?? "",
      requestedById: grant.beneficiaryId ?? systemUserId,
      vendorId: subscription?.vendorId ?? virtualCard.vendorId ?? null,
      description: expenseDescription,
      amount,
      frequency: subscription ? "MONTHLY" as const : "ONE_TIME" as const,
      expenseType: subscription ? "subscription" : "purchase",
      vendorName: subscription?.vendor?.name ?? merchantName,
      riskClassification: "PENDING" as const,
      status: "PENDING" as const,
    };

    const expense = await prisma.expenseRequest.create({
      data: expenseData,
    });

    // Update transaction with expense link
    await prisma.transaction.update({
      where: { id: txRecord.id },
      data: { expenseId: expense.id },
    });

    // 8. Run compliance classification
    const classifiableExpense = {
      expenseType: expense.expenseType,
      description: expense.description,
      vendorType: subscription?.vendor?.type ?? "ONE_TIME_VENDOR",
      amount,
      category: categoryId ?? "uncategorized",
      frequency: expense.frequency,
    };

    const benefitFlags = grant.benefitFlags as {
      ssi: boolean;
      ssdi: boolean;
      mediCal: boolean;
      medicaid: boolean;
      able: boolean;
    } | null;

    const classification = classifyExpense(classifiableExpense, benefitFlags);

    // Update expense with classification result
    await prisma.expenseRequest.update({
      where: { id: expense.id },
      data: {
        riskClassification: classification.level,
        riskNotes: classification.reason,
      },
    });

    // 9. Check auto-approval
    const autoApproveResult = await shouldAutoApprove({
      organizationId,
      amount,
      riskClassification: classification.level,
      categoryId: categoryId ?? undefined,
    });

    if (autoApproveResult.approved) {
      // 10. Auto-approve: update expense, grant balance, create ledger entry
      const updatedGrant = await prisma.grant.update({
        where: { id: grantId },
        data: {
          spentAmount: { increment: amount },
          remainingAmount: { decrement: amount },
        },
      });

      await prisma.expenseRequest.update({
        where: { id: expense.id },
        data: {
          status: "APPROVED",
          approvedById: systemUserId,
          approvedAt: new Date(),
        },
      });

      // Immutable LedgerEntry
      await prisma.ledgerEntry.create({
        data: {
          grantId,
          categoryId: categoryId ?? null,
          expenseId: expense.id,
          type: "DEBIT",
          amount,
          balanceAfter: Number(updatedGrant.remainingAmount),
          description: `Auto-approved: ${merchantName} ($${amount.toFixed(2)})`,
          reference: stripeTransactionId,
        },
      });

      // AuditLog for auto-approval
      await prisma.auditLog.create({
        data: {
          userId: systemUserId,
          organizationId,
          action: "auto_approve",
          entityType: "expense",
          entityId: expense.id,
          newValue: {
            amount,
            merchantName,
            riskClassification: classification.level,
            autoApproveReason: autoApproveResult.reason,
            stripeTransactionId,
          },
        },
      });

      // Informational notification to admin
      if (adminUser) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            organizationId,
            type: "expense_auto_approved",
            title: "Expense auto-approved",
            message: `$${amount.toFixed(2)} charge from ${merchantName} was auto-approved (${classification.level}).`,
            entityType: "expense",
            entityId: expense.id,
            href: "/expenses",
          },
        });
      }
    } else {
      // 11. Not auto-approved — leave PENDING, notify admin
      // AuditLog for pending review
      await prisma.auditLog.create({
        data: {
          userId: systemUserId,
          organizationId,
          action: "auto_create_pending",
          entityType: "expense",
          entityId: expense.id,
          newValue: {
            amount,
            merchantName,
            riskClassification: classification.level,
            autoApproveDeclined: autoApproveResult.reason,
            stripeTransactionId,
          },
        },
      });

      // Notification: requires review
      if (adminUser) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            organizationId,
            type: "expense_submitted",
            title: "New expense requires review",
            message: `$${amount.toFixed(2)} charge from ${merchantName} needs manual review (${classification.level}).`,
            entityType: "expense",
            entityId: expense.id,
            href: "/expenses",
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // Always return 200 to Stripe to prevent retries
    console.error("Error processing card charge webhook:", error);
    return NextResponse.json({ received: true });
  }
}
