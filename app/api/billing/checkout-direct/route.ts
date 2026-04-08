// GET /api/billing/checkout-direct — Anonymous Stripe Checkout for pricing page visitors
// No authentication required. Creates a Stripe Checkout session and redirects to Stripe.
// After payment, redirects to /auth/register with checkout_success + session_id params.

import { stripe } from "@/lib/stripe";
import { TIER_CONFIG, PricingTier, coerceTier } from "@/lib/pricing";
import { NextResponse } from "next/server";

const VALID_PLANS = ["seed", "core", "network", "enterprise"] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan");

  const baseUrl =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "https://app.benefitssafe.com";
  const marketingUrl =
    process.env.NEXT_PUBLIC_MARKETING_URL || "https://benefitssafe.com";

  // Validate plan param
  if (!plan || !VALID_PLANS.includes(plan as (typeof VALID_PLANS)[number])) {
    return NextResponse.redirect(`${baseUrl}/auth/register`);
  }

  // Look up the Stripe Price ID from TIER_CONFIG
  const tierEnum = coerceTier(plan);
  const config = TIER_CONFIG[tierEnum];

  if (!config.stripePriceId) {
    return NextResponse.redirect(
      `${baseUrl}/auth/register?plan=${plan}&error=price_not_configured`,
    );
  }

  // Stripe must be configured
  if (
    !process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY === "sk_test_REMOVED_PLACEHOLDER"
  ) {
    return NextResponse.redirect(
      `${baseUrl}/auth/register?plan=${plan}&error=stripe_not_configured`,
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: config.stripePriceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          plan: plan,
          source: "pricing_page",
        },
      },
      success_url: `${baseUrl}/auth/register?plan=${plan}&checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${marketingUrl}/pricing?canceled=true`,
      allow_promotion_codes: true,
      metadata: {
        plan: plan,
        source: "pricing_page_direct",
      },
    });

    if (!session.url) {
      return NextResponse.redirect(
        `${baseUrl}/auth/register?plan=${plan}&error=checkout_failed`,
      );
    }

    return NextResponse.redirect(session.url);
  } catch (error) {
    console.error("checkout-direct error:", error);
    return NextResponse.redirect(
      `${baseUrl}/auth/register?plan=${plan}&error=checkout_failed`,
    );
  }
}
