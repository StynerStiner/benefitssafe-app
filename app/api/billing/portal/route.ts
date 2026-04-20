// @ts-nocheck
// POST /api/billing/portal — Create a Stripe Billing Portal session
// Admin-only. Returns { url } so the customer can manage their subscription
// (update payment method, view invoices, cancel) on Stripe-hosted pages.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";
import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { errorResponse } from "@/lib/error-response";
import { stripeIdempotencyKey } from "@/lib/stripe-idempotency";
import { NextResponse } from "next/server";

const ROUTE = "api/billing/portal:POST";

export async function POST() {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_REMOVED_PLACEHOLDER") {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const sub = await prisma.billingSubscription.findUnique({
      where: { organizationId },
      select: { stripeCustomerId: true },
    });

    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account. Start a subscription first." },
        { status: 400 },
      );
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
    // DDIA Ch8 — 5-minute bucket prevents duplicate portal sessions from
    // quick double-clicks while still allowing legitimate later attempts.
    const portalBucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const portalSession = await stripeCircuit.run(
      `${ROUTE}:stripe.billingPortal.sessions.create`,
      { mode: "write" },
      () => stripe.billingPortal.sessions.create(
        {
          customer: sub.stripeCustomerId,
          return_url: `${baseUrl}/settings/billing`,
        },
        { idempotencyKey: stripeIdempotencyKey("billing-portal", organizationId, String(portalBucket)) },
      ),
    );

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId,
        action: "billing_portal_opened",
        entityType: "billing_subscription",
        entityId: sub.stripeCustomerId,
        newValue: { sessionId: portalSession.id },
      },
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      const retryAfterSeconds =
        error instanceof CircuitOpenError
          ? Math.ceil(error.cooldown_ms_remaining / 1000)
          : Math.ceil(CIRCUIT_OPEN_COOLDOWN_MS / 1000);
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Stripe is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds,
        cause: error,
      });
    }
    console.error("POST /api/billing/portal error:", error);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
