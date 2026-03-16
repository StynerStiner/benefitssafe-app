// POST /api/webhooks/stripe — Stripe Issuing JIT authorization webhook
// This is the BRAIN of BenefitsSafe: approve or decline every transaction
//
// Flow:
// 1. Card is used at merchant
// 2. Stripe sends issuing_authorization.request to this webhook
// 3. We check: correct merchant? within budget? grant active? compliance pass?
// 4. We approve or decline
// 5. If approved: Stripe pulls funds from nonprofit's bank (JIT funding)
// 6. We log to ledger + audit trail
//
// CRITICAL: BenefitsSafe NEVER holds funds. Money flows directly from
// nonprofit bank -> Stripe -> vendor. We only make the approve/decline decision.

import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    // Verify webhook signature in production
    let event;
    if (process.env.STRIPE_WEBHOOK_SECRET && signature) {
      try {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        console.error("Stripe webhook signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    } else {
      // In development without webhook secret
      event = JSON.parse(body);
    }

    switch (event.type) {
      case "issuing_authorization.request": {
        return handleAuthorizationRequest(event.data.object);
      }
      case "issuing_authorization.created": {
        return handleAuthorizationCreated(event.data.object);
      }
      case "issuing_transaction.created": {
        return handleTransactionCreated(event.data.object);
      }
      default: {
        return NextResponse.json({ received: true });
      }
    }
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

// JIT Authorization — the core decision engine
async function handleAuthorizationRequest(authorization: Record<string, unknown>) {
  const card = authorization.card as Record<string, unknown>;
  const stripeCardId = card?.id as string;
  const amount = (authorization.pending_request as Record<string, unknown>)?.amount as number; // in cents
  const merchantData = authorization.merchant_data as Record<string, unknown>;

  if (!stripeCardId) {
    return NextResponse.json({ approved: false, reason: "no_card_id" });
  }

  // Find the card — ORG-ISOLATED
  const virtualCard = await prisma.virtualCard.findUnique({
    where: { stripeCardId },
    select: {
      id: true,
      organizationId: true,
      expenseId: true,
      vendorId: true,
      beneficiaryId: true,
      spendingCap: true,
      status: true,
      cardType: true,
      expiresAt: true,
      merchantLock: true,
      expense: {
        select: {
          id: true,
          grantId: true,
          categoryId: true,
          status: true,
          grant: {
            select: {
              id: true,
              status: true,
              remainingAmount: true,
              organizationId: true,
            },
          },
        },
      },
    },
  });

  if (!virtualCard) {
    console.error(`JIT: Card ${stripeCardId} not found in database`);
    return NextResponse.json({ approved: false });
  }

  // CHECKS — every one must pass
  const checks: { pass: boolean; reason: string }[] = [];

  // 1. Card must be active
  checks.push({
    pass: virtualCard.status === "ACTIVE",
    reason: `Card status: ${virtualCard.status}`,
  });

  // 2. Card must not be expired
  if (virtualCard.expiresAt) {
    checks.push({
      pass: new Date() < virtualCard.expiresAt,
      reason: "Card expiration check",
    });
  }

  // 3. Amount must be within spending cap
  if (virtualCard.spendingCap) {
    const capCents = Math.round(parseFloat(virtualCard.spendingCap.toString()) * 100);
    checks.push({
      pass: amount <= capCents,
      reason: `Amount ${amount} vs cap ${capCents} cents`,
    });
  }

  // 4. Grant must be active with sufficient funds
  if (virtualCard.expense?.grant) {
    const grant = virtualCard.expense.grant;
    checks.push({
      pass: grant.status === "ACTIVE",
      reason: `Grant status: ${grant.status}`,
    });

    const remainingCents = Math.round(parseFloat(grant.remainingAmount.toString()) * 100);
    checks.push({
      pass: amount <= remainingCents,
      reason: `Grant remaining ${remainingCents} vs amount ${amount} cents`,
    });

    // ORG ISOLATION CHECK — card org must match grant org
    checks.push({
      pass: grant.organizationId === virtualCard.organizationId,
      reason: "Organization isolation check",
    });
  }

  // 5. Merchant lock check
  if (virtualCard.merchantLock && merchantData) {
    const merchantName = (merchantData.name as string || "").toLowerCase();
    const lockedTo = virtualCard.merchantLock.toLowerCase();
    checks.push({
      pass: merchantName.includes(lockedTo) || lockedTo.includes(merchantName),
      reason: `Merchant lock: ${merchantName} vs ${lockedTo}`,
    });
  }

  const allPassed = checks.every((c) => c.pass);
  const failedChecks = checks.filter((c) => !c.pass);

  // Log the decision
  await prisma.auditLog.create({
    data: {
      userId: virtualCard.beneficiaryId || "system",
      organizationId: virtualCard.organizationId,
      action: allPassed ? "authorize_approved" : "authorize_declined",
      entityType: "transaction",
      entityId: virtualCard.id,
      newValue: JSON.parse(JSON.stringify({
        stripeCardId,
        amount: amount / 100,
        merchantName: merchantData?.name,
        merchantCategory: merchantData?.category,
        approved: allPassed,
        checks: checks.map((c) => ({ ...c })),
        failedReasons: failedChecks.map((c) => c.reason),
      })),
    },
  });

  if (!allPassed) {
    console.log(`JIT DECLINED: Card ${stripeCardId}, reasons: ${failedChecks.map((c) => c.reason).join(", ")}`);
  }

  return NextResponse.json({ approved: allPassed });
}

// After authorization is created (approved or declined)
async function handleAuthorizationCreated(authorization: Record<string, unknown>) {
  const card = authorization.card as Record<string, unknown>;
  const stripeCardId = card?.id as string;
  const approved = authorization.approved as boolean;
  const amount = (authorization.pending_request as Record<string, unknown>)?.amount as number;
  const merchantData = authorization.merchant_data as Record<string, unknown>;

  if (!stripeCardId || !approved) return NextResponse.json({ received: true });

  const virtualCard = await prisma.virtualCard.findUnique({
    where: { stripeCardId },
    select: { id: true, organizationId: true, expense: { select: { grantId: true } } },
  });

  if (virtualCard) {
    // Create transaction record
    await prisma.transaction.create({
      data: {
        organizationId: virtualCard.organizationId,
        cardId: virtualCard.id,
        stripeTransactionId: authorization.id as string,
        amount: (amount || 0) / 100,
        merchantName: (merchantData?.name as string) || "Unknown",
        merchantCategory: (merchantData?.category as string) || null,
        status: "pending",
        grantId: virtualCard.expense?.grantId || null,
      },
    });
  }

  return NextResponse.json({ received: true });
}

// When transaction is finalized
async function handleTransactionCreated(transaction: Record<string, unknown>) {
  const card = transaction.card as Record<string, unknown>;
  const stripeCardId = card?.id as string;
  const amount = transaction.amount as number; // negative = charge
  const merchantData = transaction.merchant_data as Record<string, unknown>;

  if (!stripeCardId) return NextResponse.json({ received: true });

  const virtualCard = await prisma.virtualCard.findUnique({
    where: { stripeCardId },
    select: {
      id: true,
      organizationId: true,
      expense: {
        select: {
          grantId: true,
          categoryId: true,
        },
      },
    },
  });

  if (virtualCard && virtualCard.expense) {
    const chargeAmount = Math.abs(amount) / 100;

    // Update grant spent/remaining amounts
    await prisma.grant.update({
      where: { id: virtualCard.expense.grantId },
      data: {
        spentAmount: { increment: chargeAmount },
        remainingAmount: { decrement: chargeAmount },
      },
    });

    // Update budget category
    if (virtualCard.expense.categoryId) {
      await prisma.budgetCategory.update({
        where: { id: virtualCard.expense.categoryId },
        data: {
          spentAmount: { increment: chargeAmount },
        },
      });
    }

    // Create immutable ledger entry
    const grant = await prisma.grant.findUnique({
      where: { id: virtualCard.expense.grantId },
      select: { remainingAmount: true },
    });

    await prisma.ledgerEntry.create({
      data: {
        grantId: virtualCard.expense.grantId,
        categoryId: virtualCard.expense.categoryId,
        type: "DEBIT",
        amount: chargeAmount,
        balanceAfter: parseFloat(grant?.remainingAmount?.toString() || "0"),
        description: `Card charge: ${merchantData?.name || "Unknown merchant"}`,
        reference: transaction.id as string,
      },
    });
  }

  return NextResponse.json({ received: true });
}
