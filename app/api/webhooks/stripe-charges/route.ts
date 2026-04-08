// @ts-nocheck
// POST /api/webhooks/stripe-charges — Handle Stripe Issuing card transaction events
// This is SEPARATE from /api/webhooks/stripe-billing which handles subscription billing.
// ASYNC: Creates Transaction record fast, enqueues heavy processing via QStash.

import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { enqueueJob, JobTypes } from "@/lib/queue";
import { NextResponse } from "next/server";
import type StripeType from "stripe";

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
    const transaction = event.data.object as StripeType.Issuing.Transaction;
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

    // 4. Create Transaction record (fast — the only DB write before returning 200)
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

    // 5. Enqueue heavy processing (compliance, auto-approve, ledger, notifications)
    // Returns 200 to Stripe in <500ms instead of blocking for 5+ seconds
    await enqueueJob("/api/jobs/process-charge", {
      type: JobTypes.PROCESS_CHARGE,
      data: { transactionId: txRecord.id },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    // Always return 200 to Stripe to prevent retries
    console.error("Error processing card charge webhook:", error);
    return NextResponse.json({ received: true });
  }
}
