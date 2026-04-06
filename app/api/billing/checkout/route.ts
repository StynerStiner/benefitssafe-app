// @ts-nocheck
// POST /api/billing/checkout — Create a Stripe Checkout Session for tier upgrade
// Admin-only. Returns { url } to redirect the browser to.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { TIER_CONFIG, PricingTier, coerceTier } from "@/lib/pricing";
import { NextResponse } from "next/server";
import { z } from "zod";

const checkoutSchema = z.object({
  tier: z.enum(["seed", "core", "network", "enterprise"]),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId, email } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid tier", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const tierEnum = coerceTier(parsed.data.tier);
    const config = TIER_CONFIG[tierEnum];
    if (!config.stripePriceId) {
      return NextResponse.json(
        {
          error: `The ${config.name} plan is not available. Contact support or set STRIPE_PRICE_${parsed.data.tier.toUpperCase()} env var.`,
        },
        { status: 400 },
      );
    }

    // Stripe must be configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_REMOVED_PLACEHOLDER") {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    // Find or create Stripe customer tied to this org
    const existingSub = await prisma.billingSubscription.findUnique({
      where: { organizationId },
      select: { stripeCustomerId: true },
    });

    let customerId = existingSub?.stripeCustomerId || null;
    if (!customerId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: org?.name || undefined,
        metadata: { organizationId, platform: "benefitssafe" },
      });
      customerId = customer.id;

      // Persist customer id immediately so a replay/retry finds it
      await prisma.billingSubscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          tier: "free",
          stripeCustomerId: customerId,
          status: "trialing",
        },
        update: { stripeCustomerId: customerId },
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: config.stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/billing?checkout=canceled`,
      client_reference_id: organizationId,
      metadata: {
        organizationId,
        tier: tierEnum,
        initiatedBy: userId,
      },
      subscription_data: {
        metadata: {
          organizationId,
          tier: tierEnum,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
    });

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "billing_checkout_started",
        entityType: "billing_subscription",
        entityId: checkoutSession.id,
        newValue: { tier: tierEnum, priceId: config.stripePriceId },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("POST /api/billing/checkout error:", error);
    // Surface Stripe-specific errors for debugging
    const stripeError = error as { type?: string; message?: string; code?: string };
    if (stripeError?.type === "StripeInvalidRequestError") {
      return NextResponse.json(
        { error: `Stripe configuration error: ${stripeError.message || "Invalid request"}` },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
