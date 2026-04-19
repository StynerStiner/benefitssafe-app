// @ts-nocheck
// /api/org/link-bank — Link a US bank account as the ACH origin for
// Treasury inbound transfers.
//
// GET    — return current link state { linked, last4, bankName }
// POST   — create a SetupIntent on the connected account so the client
//          can collect bank details via Stripe Elements
// PATCH  — persist a confirmed PaymentMethod id on the organization
//
// The payment method lives on the nonprofit's connected account (not the
// platform), and is used as `origin_payment_method` in
// stripe.treasury.inboundTransfers.create when the nonprofit funds their
// Financial Account.

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
import { NextResponse } from "next/server";

const ROUTE_GET = "api/org/link-bank:GET";
const ROUTE_POST = "api/org/link-bank:POST";
const ROUTE_PATCH = "api/org/link-bank:PATCH";

const ADMIN_ROLES = ["nonprofit_admin", "platform_admin"];

function circuitErrorResponse(
  error: CircuitOpenError | CircuitTimeoutError,
  route: string,
  method: "GET" | "POST" | "PATCH",
) {
  const retryAfterSeconds =
    error instanceof CircuitOpenError
      ? Math.ceil(error.cooldown_ms_remaining / 1000)
      : Math.ceil(CIRCUIT_OPEN_COOLDOWN_MS / 1000);
  return errorResponse({
    kind: "dependency_unavailable",
    message: "Stripe is currently unavailable; please retry.",
    route,
    method,
    retryAfterSeconds,
    cause: error,
  });
}

async function loadOrg(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, role: true },
  });
  if (!user?.organizationId) return { error: "User not associated with organization", status: 400 as const };
  if (!ADMIN_ROLES.includes(user.role)) return { error: "Only organization admins can manage funding source", status: 403 as const };

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      id: true,
      stripeAccountId: true,
      stripeFinancialAccountId: true,
      stripeOriginPaymentMethodId: true,
    },
  });
  if (!organization) return { error: "Organization not found", status: 404 as const };
  return { organization, userId };
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const res = await loadOrg(session.user.id);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
    const { organization } = res;

    if (!organization.stripeOriginPaymentMethodId || !organization.stripeAccountId) {
      return NextResponse.json({ linked: false });
    }

    // Fetch the PaymentMethod on the connected account so we can show the
    // admin which bank is currently on file.
    try {
      const pm = await stripeCircuit.run(
        `${ROUTE_GET}:stripe.paymentMethods.retrieve`,
        { mode: "read" },
        () => stripe.paymentMethods.retrieve(
          organization.stripeOriginPaymentMethodId,
          { stripeAccount: organization.stripeAccountId },
        ),
      );
      return NextResponse.json({
        linked: true,
        paymentMethodId: pm.id,
        bankName: pm.us_bank_account?.bank_name ?? null,
        last4: pm.us_bank_account?.last4 ?? null,
        accountType: pm.us_bank_account?.account_type ?? null,
      });
    } catch (err) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      if (err instanceof CircuitOpenError || err instanceof CircuitTimeoutError) throw err;
      console.error("[link-bank] PaymentMethod retrieve failed:", err);
      return NextResponse.json({
        linked: true,
        paymentMethodId: organization.stripeOriginPaymentMethodId,
        bankName: null,
        last4: null,
        accountType: null,
      });
    }
  } catch (error) {
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      return circuitErrorResponse(error, ROUTE_GET, "GET");
    }
    console.error("GET /api/org/link-bank error:", error);
    return NextResponse.json({ error: "Failed to load bank link status" }, { status: 500 });
  }
}

// POST — start a SetupIntent so the frontend can collect bank details
export async function POST(): Promise<NextResponse> {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const res = await loadOrg(session.user.id);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
    const { organization } = res;

    if (!organization.stripeAccountId) {
      return NextResponse.json(
        { error: "Complete Stripe onboarding before linking a bank account." },
        { status: 400 },
      );
    }

    // SetupIntent for a US bank account, off_session so the funding route
    // can debit ACH later without the admin present.
    const setupIntent = await stripeCircuit.run(
      `${ROUTE_POST}:stripe.setupIntents.create`,
      { mode: "write" },
      () => stripe.setupIntents.create(
        {
          payment_method_types: ["us_bank_account"],
          usage: "off_session",
          payment_method_options: {
            us_bank_account: {
              verification_method: "instant",
              financial_connections: {
                permissions: ["payment_method", "balances"],
              },
            },
          },
          metadata: {
            organizationId: organization.id,
            purpose: "treasury_inbound_transfer_origin",
          },
        },
        { stripeAccount: organization.stripeAccountId },
      ),
    );

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      stripeAccountId: organization.stripeAccountId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_POST,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      return circuitErrorResponse(error, ROUTE_POST, "POST");
    }
    console.error("POST /api/org/link-bank error:", error);
    return NextResponse.json({ error: "Failed to start bank link" }, { status: 500 });
  }
}

// PATCH — persist the confirmed PaymentMethod id from the frontend flow
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    await assertDbHealthy();
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const res = await loadOrg(session.user.id);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
    const { organization } = res;

    const body = await request.json();
    const paymentMethodId = typeof body?.paymentMethodId === "string" ? body.paymentMethodId : null;
    if (!paymentMethodId || !paymentMethodId.startsWith("pm_")) {
      return NextResponse.json({ error: "Valid paymentMethodId is required" }, { status: 400 });
    }

    if (!organization.stripeAccountId) {
      return NextResponse.json({ error: "Connect Stripe first" }, { status: 400 });
    }

    // Verify the PaymentMethod exists on the connected account before we save it.
    let pm;
    try {
      pm = await stripeCircuit.run(
        `${ROUTE_PATCH}:stripe.paymentMethods.retrieve`,
        { mode: "read" },
        () => stripe.paymentMethods.retrieve(
          paymentMethodId,
          { stripeAccount: organization.stripeAccountId },
        ),
      );
    } catch (err) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      if (err instanceof CircuitOpenError || err instanceof CircuitTimeoutError) throw err;
      console.error("[link-bank] PaymentMethod verify failed:", err);
      return NextResponse.json({ error: "PaymentMethod not found on your Stripe account" }, { status: 400 });
    }

    if (pm.type !== "us_bank_account") {
      return NextResponse.json({ error: "Only us_bank_account PaymentMethods are supported" }, { status: 400 });
    }

    await prisma.organization.update({
      where: { id: organization.id },
      data: { stripeOriginPaymentMethodId: paymentMethodId },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: organization.id,
        action: "update",
        entityType: "organization",
        entityId: organization.id,
        newValue: {
          action: "origin_payment_method_linked",
          paymentMethodId,
          bankName: pm.us_bank_account?.bank_name ?? null,
          last4: pm.us_bank_account?.last4 ?? null,
        },
      },
    });

    return NextResponse.json({
      linked: true,
      paymentMethodId,
      bankName: pm.us_bank_account?.bank_name ?? null,
      last4: pm.us_bank_account?.last4 ?? null,
    });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE_PATCH,
        method: "PATCH",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      return circuitErrorResponse(error, ROUTE_PATCH, "PATCH");
    }
    console.error("PATCH /api/org/link-bank error:", error);
    return NextResponse.json({ error: "Failed to save bank link" }, { status: 500 });
  }
}
