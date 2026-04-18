// GET /api/billing/checkout-direct — Anonymous Stripe Checkout for pricing page visitors
// No authentication required. Creates a Stripe Checkout session and redirects to Stripe.
// After payment, redirects to /auth/register with checkout_success + session_id params.

import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
} from "@/lib/stripe-circuit";
import { TIER_CONFIG, PricingTier, coerceTier } from "@/lib/pricing";
import { NextResponse } from "next/server";

const ROUTE = "api/billing/checkout-direct:GET";

const VALID_PLANS = ["seed", "core", "network", "enterprise"] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const plan = searchParams.get("plan");

  const baseUrl = "https://app.benefitssafe.com";
  const marketingUrl = "https://benefitssafe.com";

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
    // `plan` + `config.stripePriceId` are both narrowed by guards above, but
    // TypeScript's member-access + param narrowing doesn't always carry into
    // the arrow-function closure that stripeCircuit.run() creates. Hoist both
    // into local const values so the closure sees clean `string` types.
    const validatedPlan: string = plan;
    const priceId: string = config.stripePriceId;
    const session = await stripeCircuit.run(
      `${ROUTE}:stripe.checkout.sessions.create`,
      { mode: "write" },
      () => stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            plan: validatedPlan,
            source: "pricing_page",
          },
        },
        success_url: `${baseUrl}/auth/register?plan=${validatedPlan}&checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${marketingUrl}/pricing?canceled=true`,
        allow_promotion_codes: true,
        metadata: {
          plan: validatedPlan,
          source: "pricing_page_direct",
        },
      }),
    );

    if (!session.url) {
      return NextResponse.redirect(
        `${baseUrl}/auth/register?plan=${plan}&error=checkout_failed`,
      );
    }

    return NextResponse.redirect(session.url);
  } catch (error) {
    // Redirect-based route — browser is the client, not an API consumer.
    // Circuit open / timeout redirects with an explicit error marker so
    // the landing page can show "Stripe unavailable, try again later"
    // instead of a generic "checkout failed". Deviation from the standard
    // errorResponse() 503 pattern is intentional for this flow.
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      return NextResponse.redirect(
        `${baseUrl}/auth/register?plan=${plan}&error=stripe_unavailable`,
      );
    }
    console.error("checkout-direct error:", error);
    return NextResponse.redirect(
      `${baseUrl}/auth/register?plan=${plan}&error=checkout_failed`,
    );
  }
}
