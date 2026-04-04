// GET /api/billing/status
// Returns the current billing context for the signed-in org:
//   - trial status + days remaining
//   - active tier (during trial: effective tier is ENTERPRISE)
//   - billing subscription record (if any)
//   - usage vs limits for billing page progress bars
//
// Admin and beneficiary users can both read (beneficiaries see limited view).

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getOrgTier, getTrialStatus } from "@/lib/feature-gates";
import { getUsageVsLimits } from "@/lib/usage-tracker";
import { getTierConfig, PricingTier } from "@/lib/pricing";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = session.user;

    const [tierCtx, trialStatus, usage, billingSub] = await Promise.all([
      getOrgTier(organizationId),
      getTrialStatus(organizationId),
      getUsageVsLimits(organizationId),
      prisma.billingSubscription.findUnique({
        where: { organizationId },
        select: {
          tier: true,
          status: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      }),
    ]);

    // Paid tier is the tier on BillingSubscription (or FREE if none). The
    // "effective" tier from getOrgTier may be ENTERPRISE during trial.
    const paidTier = (billingSub?.tier as PricingTier | undefined) || PricingTier.FREE;
    const paidTierConfig = getTierConfig(paidTier);
    const effectiveTierConfig = getTierConfig(tierCtx.tier);

    return NextResponse.json({
      trial: {
        inTrial: trialStatus.inTrial,
        expired: trialStatus.expired,
        daysRemaining: trialStatus.daysRemaining,
        trialEndDate: trialStatus.trialEndDate,
      },
      effectiveTier: {
        id: tierCtx.tier,
        name: effectiveTierConfig.name,
        price: effectiveTierConfig.price,
      },
      paidTier: {
        id: paidTier,
        name: paidTierConfig.name,
        price: paidTierConfig.price,
      },
      billingSubscription: billingSub
        ? {
            tier: billingSub.tier,
            status: billingSub.status,
            hasStripeCustomer: Boolean(billingSub.stripeCustomerId),
            hasStripeSubscription: Boolean(billingSub.stripeSubscriptionId),
            currentPeriodStart: billingSub.currentPeriodStart,
            currentPeriodEnd: billingSub.currentPeriodEnd,
            cancelAtPeriodEnd: billingSub.cancelAtPeriodEnd,
          }
        : null,
      usage,
    });
  } catch (error) {
    console.error("GET /api/billing/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
