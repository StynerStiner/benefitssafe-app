// @ts-nocheck
// POST /api/webhooks/stripe-charges — Handle Stripe Issuing card transaction events
// This is SEPARATE from /api/webhooks/stripe-billing which handles subscription billing.
// ASYNC: Creates Transaction record fast, enqueues heavy processing via QStash.

import { invalidateDashboardCache } from "@/lib/data";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { enqueueJob, JobTypes } from "@/lib/queue";
import { sendEmail } from "@/lib/services/email-service";
import { buildPaymentReceivedEmail } from "@/lib/services/email-templates";
import { markWebhookProcessed, releaseWebhookEvent } from "@/lib/webhook-idempotency";
import { NextResponse } from "next/server";
import type StripeType from "stripe";

const APP_BASE_URL =
  process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";

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

  // Idempotency guard: duplicate deliveries (Stripe retries, or two
  // Lambdas racing on the same retry) return 200 immediately without
  // re-processing. The Transaction table also has a unique index on
  // stripeTransactionId as a second line of defense, but that kicks in
  // later in the flow and is row-level rather than event-level.
  const { firstTime } = await markWebhookProcessed(event.id, "stripe-charges");
  if (!firstTime) {
    return NextResponse.json({ received: true, deduped: true });
  }

  // Handle declined authorizations
  if (event.type === "issuing_authorization.created") {
    const authObj = event.data.object as StripeType.Issuing.Authorization;
    if (!authObj.approved) {
      try {
        const stripeCardId = typeof authObj.card === "string" ? authObj.card : authObj.card?.id;
        const virtualCard = stripeCardId ? await prisma.virtualCard.findUnique({
          where: { stripeCardId },
          select: { id: true, organizationId: true, beneficiaryId: true },
        }) : null;

        if (virtualCard) {
          // Create declined transaction record
          await prisma.transaction.create({
            data: {
              organizationId: virtualCard.organizationId,
              cardId: virtualCard.id,
              stripeTransactionId: authObj.id,
              amount: Math.abs((authObj.pending_request?.amount || 0)) / 100,
              merchantName: authObj.merchant_data?.name || "Unknown",
              merchantCategory: authObj.merchant_data?.category || null,
              status: "declined",
              declinedReason: authObj.request_history?.[0]?.reason || "unknown",
            },
          }).catch(() => {}); // Ignore duplicate

          // Audit log
          await prisma.auditLog.create({
            data: {
              userId: virtualCard.beneficiaryId || "system",
              organizationId: virtualCard.organizationId,
              action: "transaction_declined",
              entityType: "transaction",
              entityId: virtualCard.id,
              newValue: JSON.parse(JSON.stringify({
                amount: Math.abs((authObj.pending_request?.amount || 0)) / 100,
                merchantName: authObj.merchant_data?.name,
                reason: authObj.request_history?.[0]?.reason,
              })),
            },
          });

          // Notify admins
          const admins = await prisma.user.findMany({
            where: { organizationId: virtualCard.organizationId, role: { in: ["nonprofit_admin", "platform_admin"] } },
            select: { id: true },
          });
          for (const admin of admins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                organizationId: virtualCard.organizationId,
                type: "transaction_declined",
                title: "Card transaction declined",
                message: `A $${(Math.abs((authObj.pending_request?.amount || 0)) / 100).toFixed(2)} charge at ${authObj.merchant_data?.name || "Unknown"} was declined. Reason: ${authObj.request_history?.[0]?.reason || "unknown"}.`,
                entityId: virtualCard.id,
                href: "/audit-trail",
              },
            });
          }
        }
      } catch (err) {
        console.error("Error processing declined authorization:", err);
        await releaseWebhookEvent(event.id);
        return NextResponse.json(
          { error: "Processing failed" },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ received: true });
  }

  // Only handle issuing transaction events for completed charges
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

    // 4a. Fire-and-forget vendor payment_received email.
    // If this card is linked to a vendor (via active subscription or via the
    // card's direct vendor lock), let that vendor know a payment was processed.
    const vendorIdForEmail =
      subscription?.vendor?.id || virtualCard.vendorId || null;
    if (vendorIdForEmail) {
      (async () => {
        try {
          const [vendor, org] = await Promise.all([
            prisma.vendor.findUnique({
              where: { id: vendorIdForEmail },
              select: { name: true, email: true },
            }),
            prisma.organization.findUnique({
              where: { id: organizationId },
              select: { name: true },
            }),
          ]);
          if (vendor?.email) {
            const tmpl = buildPaymentReceivedEmail({
              vendorName: vendor.name,
              amount: `$${amount.toFixed(2)}`,
              invoiceRef: stripeTransactionId,
              paymentDate: new Date().toISOString().slice(0, 10),
              dashboardUrl: `${APP_BASE_URL}/invoices`,
              orgName: org?.name || undefined,
            });
            sendEmail({
              to: vendor.email,
              subject: tmpl.subject,
              html: tmpl.html,
              text: tmpl.text,
              orgName: org?.name || undefined,
              organizationId,
              emailType: "payment_received",
            }).catch((err) =>
              console.error("[stripe-charges payment_received] send failed:", err),
            );
          }
        } catch (err) {
          console.error("[stripe-charges payment_received] lookup failed:", err);
        }
      })();
    }

    // 5. Enqueue heavy processing (compliance, auto-approve, ledger, notifications)
    // Returns 200 to Stripe in <500ms instead of blocking for 5+ seconds
    await enqueueJob("/api/jobs/process-charge", {
      type: JobTypes.PROCESS_CHARGE,
      data: { transactionId: txRecord.id },
    });

    // Invalidate the dashboard roll-up so the new transaction appears on
    // the admin dashboard immediately. (DDIA Ch5 Replication audit.)
    await invalidateDashboardCache(organizationId);

    return NextResponse.json({ received: true });
  } catch (error) {
    // CRITICAL: return 500 and release the idempotency row so Stripe
    // retries the event. The old behavior ("always return 200") combined
    // with markWebhookProcessed above silently dropped card charges during
    // any transient DB failure — Stripe would see success, never retry,
    // and the Transaction/Ledger writes would never happen. (DDIA Ch5
    // Replication audit — fintech data-loss path.)
    console.error("Error processing card charge webhook:", error);
    await releaseWebhookEvent(event.id);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 },
    );
  }
}
