// @ts-nocheck
// POST /api/org/stripe-onboarding
// Creates or retrieves Stripe Connect onboarding link for organization
// Allows nonprofit admin to complete bank account verification and payout setup

import { auth } from "@/auth";
import { NextResponse } from "next/server";
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

const ROUTE_POST = "api/org/stripe-onboarding:POST";
const ROUTE_GET = "api/org/stripe-onboarding:GET";

function circuitErrorResponse(
  error: CircuitOpenError | CircuitTimeoutError,
  route: string,
  method: "GET" | "POST",
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

interface OnboardingResponse {
  url?: string;
  accountId?: string;
  status?: string;
  error?: string;
}

export async function POST(request: Request): Promise<NextResponse<OnboardingResponse>> {
  try {
    await assertDbHealthy();
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

      // DDIA Ch8 — idempotency keys on both variants. The "full capabilities"
      // attempt and the "transfers only" retry use distinct keys so
      // Stripe doesn't 409 on the retry when it's semantically a different
      // request.
      let account;
      try {
        account = await stripeCircuit.run(
          `${ROUTE_POST}:stripe.accounts.create:full`,
          { mode: "write" },
          () => stripe.accounts.create(
            {
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
            },
            { idempotencyKey: stripeIdempotencyKey("onboard-acct", "full", organization.id) },
          ),
        );
      } catch (createError: unknown) {
        // Pattern β: bubble circuit errors to outer catch for 503 mapping.
        // Circuit error messages never contain "treasury"/"card_issuing"
        // so the existing discriminator would rethrow, but making this
        // explicit prevents a future refactor of the guard from silently
        // swallowing circuit opens.
        if (createError instanceof CircuitOpenError || createError instanceof CircuitTimeoutError) throw createError;
        const errMsg = createError instanceof Error ? createError.message : "";
        if (errMsg.includes("treasury") || errMsg.includes("card_issuing")) {
          account = await stripeCircuit.run(
            `${ROUTE_POST}:stripe.accounts.create:transfers`,
            { mode: "write" },
            () => stripe.accounts.create(
              {
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
              },
              { idempotencyKey: stripeIdempotencyKey("onboard-acct", "transfers", organization.id) },
            ),
          );
        } else {
          throw createError;
        }
      }
      accountId = account.id;

      // Create a Treasury Financial Account for this connected account
      let financialAccountId: string | null = null;
      try {
        const financialAccount = await stripeCircuit.run(
          `${ROUTE_POST}:stripe.treasury.financialAccounts.create`,
          { mode: "write" },
          () => stripe.treasury.financialAccounts.create(
            {
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
            },
            {
              stripeAccount: account.id,
              idempotencyKey: stripeIdempotencyKey("onboard-treasury", organization.id),
            },
          ),
        );
        financialAccountId = financialAccount.id;
      } catch (treasuryError) {
        // Pattern β: bubble circuit errors to outer catch for 503 mapping.
        // Circuit open during Treasury create must NOT degrade to null FA
        // id — that would persist an incomplete org state. Reject with
        // 503 and let the admin retry once Stripe is healthy.
        if (treasuryError instanceof CircuitOpenError || treasuryError instanceof CircuitTimeoutError) throw treasuryError;
        console.warn("Treasury Financial Account creation failed:", treasuryError);
        // Store null — Treasury can be configured later. Never store mock IDs.
        financialAccountId = null;
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

    // Create onboarding link. 5-minute bucket dedupes quick retries.
    const linkBucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const onboardingLink = await stripeCircuit.run(
      `${ROUTE_POST}:stripe.accountLinks.create`,
      { mode: "write" },
      () => stripe.accountLinks.create(
        {
          account: accountId,
          type: "account_onboarding",
          // When user completes onboarding, redirect to dashboard
          success_url: `${process.env.NEXTAUTH_URL || "http://localhost:3002"}/org-settings?stripe_connect_success=true`,
          // If user closes onboarding without completing, redirect to retry
          failure_url: `${process.env.NEXTAUTH_URL || "http://localhost:3002"}/org-settings?stripe_connect_success=false`,
        },
        { idempotencyKey: stripeIdempotencyKey("onboard-link", accountId, String(linkBucket)) },
      ),
    );

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
    const account = await stripeCircuit.run(
      `${ROUTE_GET}:stripe.accounts.retrieve`,
      { mode: "read" },
      () => stripe.accounts.retrieve(organization.stripeAccountId),
    );

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
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      return circuitErrorResponse(error, ROUTE_GET, "GET");
    }
    console.error("GET /api/org/stripe-onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to check onboarding status" },
      { status: 500 },
    );
  }
}
