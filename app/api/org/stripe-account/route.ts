// GET /api/org/stripe-account — Get connected Stripe account details
// Returns bank connection status, external accounts, and funding method

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE = "api/org/stripe-account:GET";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId } = session.user;
    if (role !== "nonprofit_admin" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        stripeAccountId: true,
        stripeFinancialAccountId: true,
      },
    });

    if (!org?.stripeAccountId) {
      return NextResponse.json({
        connected: false,
        bankName: null,
        last4: null,
        connectedAt: null,
        onboardingComplete: false,
        hasFinancialAccount: false,
      });
    }

    try {
      const accountId: string = org.stripeAccountId;
      const account = await stripeCircuit.run(
        `${ROUTE}:stripe.accounts.retrieve`,
        { mode: "read" },
        () => stripe.accounts.retrieve(accountId),
      );

      // Get external accounts (bank accounts linked to this Connect account)
      let bankName: string | null = null;
      let last4: string | null = null;

      if (account.external_accounts?.data && account.external_accounts.data.length > 0) {
        const bank = account.external_accounts.data[0];
        if ("bank_name" in bank) bankName = bank.bank_name || null;
        if ("last4" in bank) last4 = bank.last4 || null;
      }

      const onboardingComplete = account.details_submitted === true;

      return NextResponse.json({
        connected: true,
        bankName,
        last4,
        connectedAt: account.created ? new Date(account.created * 1000).toISOString() : null,
        onboardingComplete,
        hasFinancialAccount: !!org.stripeFinancialAccountId,
        payoutsEnabled: account.payouts_enabled || false,
        chargesEnabled: account.charges_enabled || false,
      });
    } catch (err) {
      // Pattern β: bubble circuit errors to outer catch for 503 mapping.
      if (err instanceof CircuitOpenError || err instanceof CircuitTimeoutError) throw err;
      return NextResponse.json({
        connected: true,
        bankName: null,
        last4: null,
        connectedAt: null,
        onboardingComplete: false,
        hasFinancialAccount: false,
        error: "Unable to retrieve account details",
      });
    }
  } catch (error) {
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      const retryAfterSeconds =
        error instanceof CircuitOpenError
          ? Math.ceil(error.cooldown_ms_remaining / 1000)
          : Math.ceil(CIRCUIT_OPEN_COOLDOWN_MS / 1000);
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Stripe is currently unavailable; please retry.",
        route: ROUTE,
        method: "GET",
        retryAfterSeconds,
        cause: error,
      });
    }
    console.error("GET /api/org/stripe-account error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
