// GET /api/org/stripe-account — Get connected Stripe account details
// Returns bank connection status, external accounts, and funding method

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

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
      const account = await stripe.accounts.retrieve(org.stripeAccountId);

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
    } catch {
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
    console.error("GET /api/org/stripe-account error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
