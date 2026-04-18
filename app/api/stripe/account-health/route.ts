// @ts-nocheck
// GET /api/stripe/account-health
// Admin endpoint to check Stripe Connect account health
// Shows onboarding status, requirements, payout settings, etc.

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { errorResponse } from "@/lib/error-response";

const ROUTE = "api/stripe/account-health:GET";

export async function GET(request: Request) {
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
        role: true,
        organizationId: true,
      },
    });

    if (user?.role !== "nonprofit_admin" && user?.role !== "platform_admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    // For platform admin, check all accounts. For org admin, check own account
    let organizations;
    if (user.role === "platform_admin") {
      organizations = await prisma.organization.findMany({
        where: {
          stripeAccountId: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          stripeAccountId: true,
        },
      });
    } else {
      organizations = await prisma.organization.findMany({
        where: {
          id: user.organizationId,
          stripeAccountId: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          stripeAccountId: true,
        },
      });
    }

    // Fetch account health for each organization
    const accountHealths = await Promise.all(
      organizations.map(async (org) => {
        if (!org.stripeAccountId) {
          return {
            organizationId: org.id,
            organizationName: org.name,
            status: "not_connected",
          };
        }

        try {
          const account = await stripeCircuit.run(
            `${ROUTE}:stripe.accounts.retrieve`,
            { mode: "read" },
            () => stripe.accounts.retrieve(org.stripeAccountId),
          );

          return {
            organizationId: org.id,
            organizationName: org.name,
            stripeAccountId: account.id,
            accountStatus: account.type,
            requirements: {
              currentlyDue: account.requirements?.currently_due || [],
              eventuallyDue: account.requirements?.eventually_due || [],
              pastDue: account.requirements?.past_due || [],
            },
            capabilities: {
              charges: account.capabilities?.card_payments || "inactive",
              transfers: account.capabilities?.transfers || "inactive",
              cardIssuing: account.capabilities?.card_issuing || "inactive",
            },
            settings: {
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled,
              defaultCurrency: account.default_currency,
            },
            businessProfile: {
              name: account.business_profile?.name,
              category: account.business_profile?.product_category,
            },
            verification: {
              status: account.verification?.status,
              fieldsNeeded: account.verification?.fields_needed || [],
            },
            createdAt: new Date(account.created * 1000).toISOString(),
            updatedAt: new Date(account.created * 1000).toISOString(),
            readinessScore: calculateReadinessScore(account),
          };
        } catch (error) {
          // Pattern β: bubble circuit errors to outer catch for 503 mapping.
          if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) throw error;
          console.error(`Failed to fetch Stripe account ${org.stripeAccountId}:`, error);
          return {
            organizationId: org.id,
            organizationName: org.name,
            stripeAccountId: org.stripeAccountId,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );

    // Get summary statistics
    const summary = {
      totalOrganizations: organizations.length,
      fullyOnboarded: accountHealths.filter(
        (h) =>
          h.requirements?.currentlyDue?.length === 0 &&
          (h as any).capabilities?.charges === "active"
      ).length,
      pendingRequirements: accountHealths.filter(
        (h) => (h.requirements?.currentlyDue || []).length > 0
      ).length,
      payoutsEnabled: accountHealths.filter((h) => (h as any).settings?.payoutsEnabled).length,
      averageReadiness: Math.round(
        accountHealths.reduce((sum, h) => sum + ((h as any).readinessScore || 0), 0) /
          accountHealths.length
      ),
    };

    return NextResponse.json({
      accounts: accountHealths,
      summary,
      timestamp: new Date().toISOString(),
    });
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
    console.error("GET /api/stripe/account-health error:", error);
    return NextResponse.json(
      { error: "Failed to fetch account health" },
      { status: 500 },
    );
  }
}

// Helper: Calculate onboarding readiness score (0-100)
function calculateReadinessScore(account: any): number {
  let score = 100;

  // Deductions for missing requirements
  const currentlyDue = account.requirements?.currently_due || [];
  const pastDue = account.requirements?.past_due || [];

  score -= currentlyDue.length * 10; // Each missing requirement costs 10 points
  score -= pastDue.length * 20; // Each past-due requirement costs 20 points

  // Deductions for disabled capabilities
  if (!account.charges_enabled) score -= 25;
  if (!account.payouts_enabled) score -= 25;

  return Math.max(0, score);
}
