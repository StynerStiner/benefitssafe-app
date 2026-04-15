// @ts-nocheck
// POST /api/webhooks/stripe-billing — Stripe Billing webhooks (platform subscriptions)
//
// SEPARATE endpoint from /api/webhooks/stripe (Issuing/JIT authorizations).
// This webhook handles BenefitsSafe's own subscription billing: customers
// upgrading tiers, invoice payments, cancellations, etc.
//
// Signature verification uses STRIPE_BILLING_WEBHOOK_SECRET (distinct from
// STRIPE_WEBHOOK_SECRET used for Issuing).
//
// Idempotency: every handler uses upsert-by-unique-key or find+update so
// replaying the same event yields the same end state. AuditLogs may occasionally
// duplicate — they are immutable and duplicates are harmless.

import { invalidateDashboardCache } from "@/lib/data";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { coerceTier, TIER_CONFIG, PricingTier } from "@/lib/pricing";
import { sendEmail } from "@/lib/services/email-service";
import { buildComplianceAlertEmail } from "@/lib/services/email-templates";
import { markWebhookProcessed, releaseWebhookEvent } from "@/lib/webhook-idempotency";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

const APP_BASE_URL =
  process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";

// ----------------------------------------------------------------------------
// Helper: resolve a Stripe priceId back to our internal tier
// ----------------------------------------------------------------------------
function tierFromPriceId(priceId: string | null | undefined): PricingTier {
  if (!priceId) return PricingTier.FREE;
  for (const tierKey of Object.values(PricingTier)) {
    const config = TIER_CONFIG[tierKey as PricingTier];
    if (config.stripePriceId === priceId) return tierKey as PricingTier;
  }
  return PricingTier.FREE;
}

// ----------------------------------------------------------------------------
// Helper: notify all admins of an org
// ----------------------------------------------------------------------------
async function notifyAdmins(
  organizationId: string,
  type: string,
  title: string,
  message: string,
  href: string = "/settings/billing",
  emailSeverity: "low" | "medium" | "high" | "critical" | null = null,
) {
  const admins = await prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      role: { in: ["nonprofit_admin", "platform_admin", "billing_admin"] },
    },
    select: { id: true, email: true, firstName: true },
  });

  // Look up org name once for email branding.
  let orgName: string | undefined;
  if (emailSeverity && admins.length > 0) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    orgName = org?.name || undefined;
  }

  for (const admin of admins) {
    await prisma.notification.create({
      data: { userId: admin.id, organizationId, type, title, message, href },
    });

    // Fire-and-forget email fan-out when the caller requests it.
    if (emailSeverity && admin.email) {
      const tmpl = buildComplianceAlertEmail({
        adminFirstName: admin.firstName || "there",
        alertTitle: title,
        alertDescription: message,
        severity: emailSeverity,
        actionUrl: `${APP_BASE_URL}${href}`,
        orgName,
      });
      sendEmail({
        to: admin.email,
        subject: tmpl.subject,
        html: tmpl.html,
        text: tmpl.text,
        orgName,
        userId: admin.id,
        organizationId,
        emailType: "compliance_alert",
      }).catch((err) =>
        console.error("[stripe-billing] email send failed:", err),
      );
    }
  }
}

// ----------------------------------------------------------------------------
// Entrypoint
// ----------------------------------------------------------------------------
export async function POST(request: Request) {
  // Track whether we committed the idempotency row before the failure.
  // If we did and processing then threw, we MUST release the row before
  // returning 500 so Stripe's retry can re-enter processing — otherwise
  // the retry lands, sees the row, and returns deduped:true without ever
  // running the handler again. (DDIA Ch5 Replication audit — this route
  // was silently dropping billing state changes during any DB hiccup.)
  let processedEventId: string | null = null;

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;

    // --- Signature verification ---
    let event: Stripe.Event;
    if (!webhookSecret) {
      if (process.env.NODE_ENV === "production") {
        console.error("STRIPE_BILLING_WEBHOOK_SECRET is not set in production");
        return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
      }
      // Development only: allow unsigned payloads for local testing
      event = JSON.parse(body) as Stripe.Event;
    } else if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    } else {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error("Stripe billing webhook signature verification failed:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    // --- Idempotency guard ---
    // Dedupe by event.id so Stripe retries (up to 3 days) don't re-run
    // side effects like double tier upgrades, duplicate invoice emails,
    // or duplicate billing audit entries.
    const { firstTime } = await markWebhookProcessed(event.id, "stripe-billing");
    if (!firstTime) {
      return NextResponse.json({ received: true, deduped: true });
    }
    processedEventId = event.id;

    // --- Dispatch ---
    // Each handler returns the affected organizationId (or null when the
    // event doesn't map to a known org — e.g. a subscription.updated for
    // a Stripe sub we never recorded). We use that to invalidate the
    // dashboard roll-up once after successful processing.
    let affectedOrg: string | null = null;
    switch (event.type) {
      case "checkout.session.completed":
        affectedOrg = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
        affectedOrg = await handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
          new Date(event.created * 1000),
        );
        break;
      case "customer.subscription.updated":
        affectedOrg = await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          new Date(event.created * 1000),
        );
        break;
      case "customer.subscription.deleted":
        affectedOrg = await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          new Date(event.created * 1000),
        );
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        affectedOrg = await handleInvoicePaid(
          event.data.object as Stripe.Invoice,
          new Date(event.created * 1000),
        );
        break;
      case "invoice.payment_failed":
        affectedOrg = await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
          new Date(event.created * 1000),
        );
        break;
      default:
        // Ignore unhandled events (no error — Stripe retries on non-2xx)
        break;
    }

    // Invalidate dashboard cache once per webhook, if we know the affected
    // org. Billing events mutate Organization.subscriptionStatus and the
    // trial banner reads session.user.subscriptionStatus, so users need
    // to see the state flip immediately on next page load. (DDIA Ch5 audit.)
    if (affectedOrg) {
      await invalidateDashboardCache(affectedOrg);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("stripe-billing webhook handler error:", err);
    if (processedEventId) {
      await releaseWebhookEvent(processedEventId);
    }
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}

// ----------------------------------------------------------------------------
// Event handlers
// ----------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<string | null> {
  const organizationId = session.metadata?.organizationId;
  const tierMeta = session.metadata?.tier;
  if (!organizationId) {
    console.error("checkout.session.completed missing organizationId in metadata");
    return null;
  }

  const tier = coerceTier(tierMeta);
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;

  // Upsert BillingSubscription by organizationId (unique key → idempotent)
  await prisma.billingSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      tier,
      stripeCustomerId,
      stripeSubscriptionId,
      status: "active",
    },
    update: {
      tier,
      stripeCustomerId,
      stripeSubscriptionId,
      status: "active",
    },
  });

  // Flip org subscription status from trial → active
  await prisma.organization.update({
    where: { id: organizationId },
    data: { subscriptionStatus: "active" },
  });

  await prisma.auditLog.create({
    data: {
      userId: "system",
      organizationId,
      action: "billing_checkout_completed",
      entityType: "billing_subscription",
      entityId: stripeSubscriptionId || session.id,
      newValue: { tier, stripeCustomerId, stripeSubscriptionId },
    },
  });

  const tierName = TIER_CONFIG[tier].name;
  await notifyAdmins(
    organizationId,
    "subscription_activated",
    "Subscription activated",
    `Your ${tierName} plan is now active. Welcome!`,
  );

  return organizationId;
}

async function handleSubscriptionCreated(
  sub: Stripe.Subscription,
  eventAt: Date,
): Promise<string | null> {
  const organizationId = sub.metadata?.organizationId;
  if (!organizationId) {
    console.error("customer.subscription.created missing organizationId in metadata");
    return null;
  }

  const priceId = sub.items.data[0]?.price.id || null;
  const tier = coerceTier(sub.metadata?.tier) === PricingTier.FREE ? tierFromPriceId(priceId) : coerceTier(sub.metadata?.tier);
  const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id || null;

  // Upsert-create is always safe (no prior row to overwrite). The update
  // branch is only reached if a race has already inserted a BillingSub row
  // for this org, in which case the ordering guard below handles staleness.
  const created = await prisma.billingSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      tier,
      stripeCustomerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      status: sub.status,
      lastBillingEventAt: eventAt,
    },
    // Only touch lastBillingEventAt here; real field updates happen below
    // under the ordering guard so a stale create can't overwrite a newer
    // update that has already landed.
    update: {},
    select: { id: true, lastBillingEventAt: true },
  });
  const result = await prisma.billingSubscription.updateMany({
    where: {
      id: created.id,
      OR: [
        { lastBillingEventAt: null },
        { lastBillingEventAt: { lt: eventAt } },
      ],
    },
    data: {
      tier,
      stripeCustomerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      status: sub.status,
      lastBillingEventAt: eventAt,
    },
  });
  if (result.count === 0) {
    console.warn("[stripe-billing] subscription.created arrived out-of-order, skipping update", {
      subId: created.id,
      eventAt: eventAt.toISOString(),
    });
  }

  // Reflect activity on Organization.subscriptionStatus
  if (sub.status === "active" || sub.status === "trialing") {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { subscriptionStatus: "active" },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: "system",
      organizationId,
      action: "subscription_created",
      entityType: "billing_subscription",
      entityId: sub.id,
      newValue: { tier, status: sub.status, priceId },
    },
  });

  return organizationId;
}

async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  eventAt: Date,
): Promise<string | null> {
  // Find by subscription id (most reliable for updates)
  const existing = await prisma.billingSubscription.findFirst({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true, organizationId: true, tier: true, status: true },
  });
  if (!existing) {
    // Fall back to metadata path to create it
    return handleSubscriptionCreated(sub, eventAt);
  }

  const priceId = sub.items.data[0]?.price.id || null;
  const newTier = tierFromPriceId(priceId);
  const previousTier = existing.tier;
  const previousStatus = existing.status;

  // Ordering guard — if a newer subscription.updated (or any later billing
  // event) has already advanced lastBillingEventAt, this retry is stale
  // and must not revert the newer tier/status. Returns count=0 which we
  // treat as a logged no-op.
  const updateResult = await prisma.billingSubscription.updateMany({
    where: {
      id: existing.id,
      OR: [
        { lastBillingEventAt: null },
        { lastBillingEventAt: { lt: eventAt } },
      ],
    },
    data: {
      tier: newTier,
      stripePriceId: priceId,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      status: sub.status,
      lastBillingEventAt: eventAt,
    },
  });
  if (updateResult.count === 0) {
    console.warn("[stripe-billing] subscription.updated arrived out-of-order, skipping", {
      subId: existing.id,
      eventAt: eventAt.toISOString(),
    });
    return existing.organizationId;
  }

  // Sync Organization.subscriptionStatus based on Stripe sub status
  if (sub.status === "active" || sub.status === "trialing") {
    await prisma.organization.update({
      where: { id: existing.organizationId },
      data: { subscriptionStatus: "active" },
    });
  } else if (sub.status === "past_due" || sub.status === "unpaid") {
    await prisma.organization.update({
      where: { id: existing.organizationId },
      data: { subscriptionStatus: "suspended" },
    });
  } else if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    await prisma.organization.update({
      where: { id: existing.organizationId },
      data: { subscriptionStatus: "expired" },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: "system",
      organizationId: existing.organizationId,
      action: "subscription_updated",
      entityType: "billing_subscription",
      entityId: sub.id,
      oldValue: { tier: previousTier, status: previousStatus },
      newValue: { tier: newTier, status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end },
    },
  });

  // Notify only on meaningful transitions
  if (previousStatus !== sub.status) {
    if (sub.status === "past_due") {
      await notifyAdmins(
        existing.organizationId,
        "payment_past_due",
        "Payment past due",
        "Your subscription payment is past due. Please update your billing information to avoid losing access.",
        "/settings/billing",
        "critical",
      );
    } else if (sub.status === "active" && previousStatus === "past_due") {
      await notifyAdmins(
        existing.organizationId,
        "payment_resumed",
        "Payment resumed",
        "Your subscription is active again. Thank you.",
      );
    }
  }
  if (previousTier !== newTier) {
    const newTierName = TIER_CONFIG[newTier].name;
    await notifyAdmins(
      existing.organizationId,
      "plan_changed",
      "Plan changed",
      `Your plan is now ${newTierName}.`,
    );
  }
  if (sub.cancel_at_period_end) {
    await notifyAdmins(
      existing.organizationId,
      "subscription_canceling",
      "Subscription scheduled to cancel",
      "Your subscription will cancel at the end of the current billing period.",
    );
  }

  return existing.organizationId;
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  eventAt: Date,
): Promise<string | null> {
  const existing = await prisma.billingSubscription.findFirst({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true, organizationId: true, tier: true },
  });
  if (!existing) return null;

  const previousTier = existing.tier;

  // Ordering guard — a late subscription.deleted retry must not clobber a
  // newer subscription.updated that has already re-activated the sub.
  const result = await prisma.billingSubscription.updateMany({
    where: {
      id: existing.id,
      OR: [
        { lastBillingEventAt: null },
        { lastBillingEventAt: { lt: eventAt } },
      ],
    },
    data: {
      tier: "free",
      status: "canceled",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      lastBillingEventAt: eventAt,
    },
  });
  if (result.count === 0) {
    console.warn("[stripe-billing] subscription.deleted arrived out-of-order, skipping", {
      subId: existing.id,
      eventAt: eventAt.toISOString(),
    });
    return existing.organizationId;
  }

  await prisma.organization.update({
    where: { id: existing.organizationId },
    data: { subscriptionStatus: "expired" },
  });

  await prisma.auditLog.create({
    data: {
      userId: "system",
      organizationId: existing.organizationId,
      action: "subscription_canceled",
      entityType: "billing_subscription",
      entityId: sub.id,
      oldValue: { tier: previousTier },
      newValue: { tier: "free", status: "canceled" },
    },
  });

  await notifyAdmins(
    existing.organizationId,
    "subscription_canceled",
    "Subscription canceled",
    "Your paid subscription has ended. Choose a plan to restore access.",
    "/settings/billing",
    "high",
  );

  return existing.organizationId;
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  eventAt: Date,
): Promise<string | null> {
  const stripeSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id || null;
  if (!stripeSubscriptionId) return null;

  const existing = await prisma.billingSubscription.findFirst({
    where: { stripeSubscriptionId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!existing) return null;

  // If we were past_due, return to active on successful payment. The
  // updateMany WHERE clause enforces DDIA Ch9 webhook ordering: if a newer
  // Stripe event (e.g. a subsequent payment_failed retry that happened to
  // land first) has already written a later lastBillingEventAt, skip the
  // update so we don't resurrect stale state. Returns affected=0 when the
  // guard rejects, which we log and treat as a no-op.
  if (existing.status === "past_due" || existing.status === "unpaid") {
    const result = await prisma.billingSubscription.updateMany({
      where: {
        id: existing.id,
        OR: [
          { lastBillingEventAt: null },
          { lastBillingEventAt: { lt: eventAt } },
        ],
      },
      data: { status: "active", lastBillingEventAt: eventAt },
    });
    if (result.count === 0) {
      console.warn("[stripe-billing] invoice.paid arrived out-of-order, skipping status update", {
        subId: existing.id,
        eventAt: eventAt.toISOString(),
      });
    } else {
      await prisma.organization.update({
        where: { id: existing.organizationId },
        data: { subscriptionStatus: "active" },
      });
    }
  } else {
    // Not a status transition, but still advance lastBillingEventAt so
    // future ordering checks have the latest high-water mark. Guarded so
    // we never move the mark backward on a late retry.
    await prisma.billingSubscription.updateMany({
      where: {
        id: existing.id,
        OR: [
          { lastBillingEventAt: null },
          { lastBillingEventAt: { lt: eventAt } },
        ],
      },
      data: { lastBillingEventAt: eventAt },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: "system",
      organizationId: existing.organizationId,
      action: "invoice_paid",
      entityType: "invoice",
      entityId: invoice.id,
      newValue: {
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        invoiceNumber: invoice.number,
      },
    },
  });

  return existing.organizationId;
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  eventAt: Date,
): Promise<string | null> {
  const stripeSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id || null;
  if (!stripeSubscriptionId) return null;

  const existing = await prisma.billingSubscription.findFirst({
    where: { stripeSubscriptionId },
    select: { id: true, organizationId: true },
  });
  if (!existing) return null;

  // Ordering guard — see handleInvoicePaid. A stale payment_failed retry
  // must not clobber a newer payment_succeeded that already advanced
  // lastBillingEventAt past `eventAt`.
  const result = await prisma.billingSubscription.updateMany({
    where: {
      id: existing.id,
      OR: [
        { lastBillingEventAt: null },
        { lastBillingEventAt: { lt: eventAt } },
      ],
    },
    data: { status: "past_due", lastBillingEventAt: eventAt },
  });
  if (result.count === 0) {
    console.warn("[stripe-billing] invoice.payment_failed arrived out-of-order, skipping status update", {
      subId: existing.id,
      eventAt: eventAt.toISOString(),
    });
    // Still record the audit log below so the attempt is visible.
  } else {
    await prisma.organization.update({
      where: { id: existing.organizationId },
      data: { subscriptionStatus: "suspended" },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: "system",
      organizationId: existing.organizationId,
      action: "invoice_payment_failed",
      entityType: "invoice",
      entityId: invoice.id,
      newValue: {
        amountDue: invoice.amount_due,
        attemptCount: invoice.attempt_count,
        invoiceNumber: invoice.number,
      },
    },
  });

  await notifyAdmins(
    existing.organizationId,
    "payment_failed",
    "Payment failed",
    `Your payment of $${(invoice.amount_due / 100).toFixed(2)} failed. Update your billing information to avoid service interruption.`,
    "/settings/billing",
    "critical",
  );

  return existing.organizationId;
}
