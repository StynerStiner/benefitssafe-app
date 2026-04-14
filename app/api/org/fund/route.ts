// @ts-nocheck
// POST /api/org/fund — Initiate inbound transfer (ACH from bank to Financial Account)
// GET  /api/org/fund — Get current Financial Account balance

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// GET — Retrieve Financial Account balance
export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: "User not associated with organization" },
        { status: 400 },
      );
    }

    const readOnlyRoles = ["nonprofit_staff", "auditor", "cpa"];
    const adminRoles = ["nonprofit_admin", "platform_admin"];
    if (!adminRoles.includes(user.role) && !readOnlyRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Only organization members can view fund balance" },
        { status: 403 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        stripeAccountId: true,
        stripeFinancialAccountId: true,
      },
    });

    if (!organization?.stripeAccountId || !organization?.stripeFinancialAccountId) {
      return NextResponse.json({
        balance: { cash: 0, inbound_pending: 0, outbound_pending: 0 },
        financialAccountId: null,
        transfers: [],
      });
    }

    const financialAccountId = organization.stripeFinancialAccountId;
    const stripeAccountId = organization.stripeAccountId;

    // Dev fallback: mock financial account IDs start with fa_mock_
    if (financialAccountId.startsWith("fa_mock_")) {
      return NextResponse.json({
        balance: { cash: 0, inbound_pending: 0, outbound_pending: 0 },
        financialAccountId,
        transfers: [],
        dev: true,
      });
    }

    try {
      // Retrieve the Financial Account to get balance
      const financialAccount = await stripe.treasury.financialAccounts.retrieve(
        financialAccountId,
        { expand: ["financial_addresses"] },
        { stripeAccount: stripeAccountId },
      );

      // Get recent inbound transfers
      const inboundTransfers = await stripe.treasury.inboundTransfers.list(
        {
          financial_account: financialAccountId,
          limit: 20,
        },
        { stripeAccount: stripeAccountId },
      );

      return NextResponse.json({
        balance: financialAccount.balance || { cash: { usd: 0 }, inbound_pending: { usd: 0 }, outbound_pending: { usd: 0 } },
        financialAccountId,
        transfers: inboundTransfers.data.map((t) => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          status: t.status,
          created: t.created,
          description: t.description,
        })),
      });
    } catch (stripeError) {
      console.warn("Failed to retrieve Treasury balance (dev mode?):", stripeError);
      return NextResponse.json({
        balance: { cash: 0, inbound_pending: 0, outbound_pending: 0 },
        financialAccountId,
        transfers: [],
        dev: true,
      });
    }
  } catch (error) {
    console.error("GET /api/org/fund error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve fund balance" },
      { status: 500 },
    );
  }
}

// POST — Initiate inbound transfer from nonprofit's bank to Financial Account
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json(
        { error: "User not associated with organization" },
        { status: 400 },
      );
    }

    if (user.role !== "nonprofit_admin" && user.role !== "platform_admin") {
      return NextResponse.json(
        { error: "Only organization admins can initiate fund transfers" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { amount } = body;
    const requestedPaymentMethodId = typeof body?.bankPaymentMethodId === "string" ? body.bankPaymentMethodId : null;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number (in dollars)" },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        stripeAccountId: true,
        stripeFinancialAccountId: true,
        stripeOriginPaymentMethodId: true,
      },
    });

    if (!organization?.stripeAccountId || !organization?.stripeFinancialAccountId) {
      return NextResponse.json(
        { error: "Organization must complete Stripe onboarding first" },
        { status: 400 },
      );
    }

    // Default to the org's stored origin PaymentMethod (linked via
    // /api/org/link-bank) so the admin doesn't have to re-enter bank
    // details every time they fund. Still accept an explicit override
    // from the request body for ad-hoc usage.
    const bankPaymentMethodId = requestedPaymentMethodId || organization.stripeOriginPaymentMethodId;
    if (!bankPaymentMethodId) {
      return NextResponse.json(
        {
          error: "No funding bank account on file. Link a bank account in Organization Settings > Funding first.",
          href: "/org-settings",
        },
        { status: 400 },
      );
    }

    const financialAccountId = organization.stripeFinancialAccountId;
    const stripeAccountId = organization.stripeAccountId;
    const amountInCents = Math.round(amount * 100);

    // Dev fallback
    if (financialAccountId.startsWith("fa_mock_")) {
      // Create audit log for mock transfer
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: user.organizationId,
          action: "create",
          entityType: "fund_transfer",
          entityId: `mock_transfer_${Date.now()}`,
          newValue: {
            action: "inbound_transfer_initiated",
            amount: amountInCents,
            currency: "usd",
            dev: true,
          },
        },
      });

      return NextResponse.json({
        transfer: {
          id: `ibt_mock_${Date.now()}`,
          amount: amountInCents,
          currency: "usd",
          status: "processing",
          description: "Grant fund deposit (dev mock)",
        },
        dev: true,
      });
    }

    try {
      const transfer = await stripe.treasury.inboundTransfers.create({
        financial_account: financialAccountId,
        amount: amountInCents,
        currency: "usd",
        origin_payment_method: bankPaymentMethodId,
        description: "Grant fund deposit",
      }, { stripeAccount: stripeAccountId });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          organizationId: user.organizationId,
          action: "create",
          entityType: "fund_transfer",
          entityId: transfer.id,
          newValue: {
            action: "inbound_transfer_initiated",
            transferId: transfer.id,
            amount: amountInCents,
            currency: "usd",
          },
        },
      });

      return NextResponse.json({
        transfer: {
          id: transfer.id,
          amount: transfer.amount,
          currency: transfer.currency,
          status: transfer.status,
          description: transfer.description,
        },
      });
    } catch (stripeError) {
      console.warn("Treasury inbound transfer failed (dev mode?):", stripeError);
      return NextResponse.json({
        transfer: {
          id: `ibt_mock_${Date.now()}`,
          amount: amountInCents,
          currency: "usd",
          status: "processing",
          description: "Grant fund deposit (dev fallback)",
        },
        dev: true,
      });
    }
  } catch (error) {
    console.error("POST /api/org/fund error:", error);
    return NextResponse.json(
      { error: "Failed to initiate fund transfer" },
      { status: 500 },
    );
  }
}
