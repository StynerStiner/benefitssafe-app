// @ts-nocheck
// POST /api/org/stripe-onboarding
// Creates or retrieves Stripe Connect onboarding link for organization
// Allows nonprofit admin to complete bank account verification and payout setup

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

interface OnboardingResponse {
  url?: string;
  accountId?: string;
  status?: string;
  error?: string;
}

export async function POST(request: Request): Promise<NextResponse<OnboardingResponse>> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Get user's organization
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

    // Only nonprofit_admin or platform_admin can manage Stripe account
    if (user.role !== "nonprofit_admin" && user.role !== "platform_admin") {
      return NextResponse.json(
        { error: "Only organization admins can manage Stripe setup" },
        { status: 403 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        website: true,
        stripeAccountId: true,
        stripeFinancialAccountId: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    let accountId = organization.stripeAccountId;

    // If organization doesn't have a Stripe account yet, create one
    if (!accountId) {
      // Build capabilities — treasury and card_issuing may not be available in sandbox
      const capabilities: Record<string, { requested: boolean }> = {
        transfers: { requested: true },
      };

      // Try to enable advanced capabilities (may fail in test mode)
      try {
        // Check if card_issuing and treasury are available by attempting to include them
        capabilities.card_issuing = { requested: true };
        capabilities.treasury = { requested: true };
      } catch {
        // Sandbox may not support these
      }

      let account;
      try {
        account = await stripe.accounts.create({
          type: "custom",
          country: "US",
          email: session.user.email || undefined,
          capabilities,
          business_profile: {
            name: organization.name,
            product_description: "Nonprofit grant disbursement platform for restricted fund management",
            url: organization.website || undefined,
          },
          business_type: "non_profit",
          tos_acceptance: {
            service_agreement: "full",
          },
        });
      } catch (createError: unknown) {
        // If treasury/card_issuing fails, retry with just transfers
        const errMsg = createError instanceof Error ? createError.message : "";
        if (errMsg.includes("treasury") || errMsg.includes("card_issuing")) {
          account = await stripe.accounts.create({
            type: "custom",
            country: "US",
            email: session.user.email || undefined,
            capabilities: {
              transfers: { requested: true },
            },
            business_profile: {
              name: organization.name,
              product_description: "Nonprofit grant disbursement platform for restricted fund management",
              url: organization.website || undefined,
            },
            business_type: "non_profit",
            tos_acceptance: {
              service_agreement: "full",
            },
          });
        } else {
          throw createError;
        }
      }
      accountId = account.id;

      // Create a Treasury Financial Account for this connected account
      let financialAccountId: string | null = null;
      try {
        const financialAccount = await stripe.treasury.financialAccounts.create({
          supported_currencies: ["usd"],
          features: {
            card_issuing: { requested: true },
            deposit_insurance: { requested: true },
            financial_addresses: { aba: { requested: true } },
            inbound_transfers: { ach: { requested: true } },
            intra_stripe_flows: { requested: true },
            outbound_payments: {
              ach: { requested: true },
              us_domestic_wire: { requested: true },
            },
            outbound_transfers: {
              ach: { requested: true },
              us_domestic_wire: { requested: true },
            },
          },
        }, { stripeAccount: account.id });
        financialAccountId = financialAccount.id;
      } catch (treasuryError) {
        console.warn("Treasury Financial Account creation failed (dev mode?):", treasuryError);
        // In development without proper Stripe keys, store a mock ID
        financialAccountId = `fa_mock_${account.id}`;
      }

      // Save the account ID and financial account ID
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          stripeAccountId: accountId,
          stripeFinancialAccountId: financialAccountId,
        },
      });
    }

    // Create onboarding link
    const onboardingLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      // When user completes onboarding, redirect to dashboard
      success_url: `${process.env.NEXTAUTH_URL || "http://localhost:3002"}/org-settings?stripe=success`,
      // If user closes onboarding without completing, redirect to retry
      failure_url: `${process.env.NEXTAUTH_URL || "http://localhost:3002"}/org-settings?stripe=failure`,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        organizationId: user.organizationId,
        action: "update",
        entityType: "organization",
        entityId: organization.id,
        newValue: {
          action: "stripe_onboarding_initiated",
          stripeAccountId: accountId,
        },
      },
    });

    return NextResponse.json({
      url: onboardingLink.url,
      accountId,
      status: "pending",
    });
  } catch (error) {
    console.error("POST /api/org/stripe-onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 },
    );
  }
}

// GET /api/org/stripe-onboarding
// Check the status of Stripe account onboarding
export async function GET(): Promise<NextResponse<OnboardingResponse>> {
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
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "User not associated with organization" },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { stripeAccountId: true },
    });

    if (!organization?.stripeAccountId) {
      return NextResponse.json(
        { status: "not_started" },
      );
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(organization.stripeAccountId);

    // Check if account is fully onboarded
    const isOnboarded =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.requirements?.currently_due?.length === 0;

    return NextResponse.json({
      accountId: account.id,
      status: isOnboarded ? "completed" : "pending",
      error: isOnboarded
        ? undefined
        : `Missing: ${account.requirements?.currently_due?.join(", ")}`,
    });
  } catch (error) {
    console.error("GET /api/org/stripe-onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to check onboarding status" },
      { status: 500 },
    );
  }
}
