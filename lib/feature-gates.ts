// Feature gates + trial enforcement for BenefitsSafe.
// Fail OPEN on database errors — never lock a paying customer out due to a bug.
//
// During 14-day trial: org gets ENTERPRISE-level access (all features, unlimited)
// After trial expires with no paid plan: org is locked to FREE tier
// After a paid plan is active: org gets its subscription's tier

import { prisma } from "@/lib/db";
import {
  PricingTier,
  coerceTier,
  getTierConfig,
  hasFeature as tierHasFeature,
  isWithinLimit,
  getLimit,
  getUsagePercentage,
  type TierFeatureKey,
  type TierLimitKey,
} from "@/lib/pricing";

// ----------------------------------------------------------------------------
// Tier resolution
// ----------------------------------------------------------------------------

type OrgTierContext = {
  tier: PricingTier;
  subscriptionStatus: string;
  inTrial: boolean;
  trialExpired: boolean;
  trialEndDate: Date | null;
};

/**
 * Resolve the effective tier for an org, accounting for trial vs paid plan.
 *
 * Rules:
 *   - org.subscriptionStatus === "trial" AND trialEndDate > now → ENTERPRISE (full access)
 *   - org.subscriptionStatus === "trial" AND trialEndDate <= now → FREE (trial lapsed)
 *   - Otherwise → whatever tier is on BillingSubscription (or FREE if none)
 *
 * Fails OPEN: if anything goes wrong, returns ENTERPRISE so we don't block a
 * legit user due to a transient DB error. Errors are logged.
 */
export async function getOrgTier(organizationId: string): Promise<OrgTierContext> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionStatus: true,
        trialEndDate: true,
        billingSubscription: { select: { tier: true, status: true } },
      },
    });

    if (!org) {
      console.warn(`[feature-gates] Org ${organizationId} not found — failing open`);
      return failOpen();
    }

    const now = new Date();
    const subscriptionStatus = org.subscriptionStatus || "trial";
    const trialEndDate = org.trialEndDate;
    const isTrialStatus = subscriptionStatus === "trial";
    const trialExpired =
      isTrialStatus && trialEndDate !== null && trialEndDate <= now;
    const inTrial = isTrialStatus && !trialExpired;

    if (inTrial) {
      return {
        tier: PricingTier.ENTERPRISE,
        subscriptionStatus,
        inTrial: true,
        trialExpired: false,
        trialEndDate,
      };
    }

    if (trialExpired && !org.billingSubscription) {
      return {
        tier: PricingTier.FREE,
        subscriptionStatus,
        inTrial: false,
        trialExpired: true,
        trialEndDate,
      };
    }

    const paidTier = coerceTier(org.billingSubscription?.tier);
    return {
      tier: paidTier,
      subscriptionStatus,
      inTrial: false,
      trialExpired,
      trialEndDate,
    };
  } catch (error) {
    console.error("[feature-gates] getOrgTier error, failing open:", error);
    return failOpen();
  }
}

function failOpen(): OrgTierContext {
  return {
    tier: PricingTier.ENTERPRISE,
    subscriptionStatus: "trial",
    inTrial: true,
    trialExpired: false,
    trialEndDate: null,
  };
}

// ----------------------------------------------------------------------------
// Feature access (boolean feature flags)
// ----------------------------------------------------------------------------

/**
 * Returns true if the org's current tier includes the given feature.
 * Fails OPEN on error.
 */
export async function checkFeatureAccess(
  organizationId: string,
  feature: TierFeatureKey,
): Promise<boolean> {
  try {
    const { tier } = await getOrgTier(organizationId);
    return tierHasFeature(tier, feature);
  } catch (error) {
    console.error("[feature-gates] checkFeatureAccess error, failing open:", error);
    return true;
  }
}

// ----------------------------------------------------------------------------
// Limit gates (quota-based)
// ----------------------------------------------------------------------------

export type LimitCheck = {
  allowed: boolean;
  current: number;
  limit: number;
  percentage: number;
  tier: PricingTier;
  unlimited: boolean;
};

/**
 * Check whether `currentCount` is still within the tier limit for `limitKey`.
 * Returns usage metadata usable by the UI (current/limit/percentage).
 * Fails OPEN on error.
 */
export async function checkLimitAccess(
  organizationId: string,
  limitKey: TierLimitKey,
  currentCount: number,
): Promise<LimitCheck> {
  try {
    const { tier } = await getOrgTier(organizationId);
    const limit = getLimit(tier, limitKey);
    const unlimited = limit === -1;
    const allowed = isWithinLimit(tier, limitKey, currentCount);
    const percentage = getUsagePercentage(tier, limitKey, currentCount);
    return {
      allowed,
      current: currentCount,
      limit,
      percentage,
      tier,
      unlimited,
    };
  } catch (error) {
    console.error("[feature-gates] checkLimitAccess error, failing open:", error);
    return {
      allowed: true,
      current: currentCount,
      limit: -1,
      percentage: 0,
      tier: PricingTier.ENTERPRISE,
      unlimited: true,
    };
  }
}

// ----------------------------------------------------------------------------
// Subscription status / trial enforcement
// ----------------------------------------------------------------------------

export type SubscriptionCheck = {
  active: boolean;
  reason?: string;
  tier: PricingTier;
  subscriptionStatus: string;
  trialExpired: boolean;
};

/**
 * Returns { active: false, reason } when:
 *   - Trial has expired AND no active paid BillingSubscription exists
 *   - BillingSubscription status is "canceled" or "unpaid"
 *
 * Used by middleware to block non-billing routes when the org cannot do work.
 * Fails OPEN on DB errors.
 */
export async function requireActiveSubscription(
  organizationId: string,
): Promise<SubscriptionCheck> {
  try {
    const ctx = await getOrgTier(organizationId);

    if (ctx.inTrial) {
      return {
        active: true,
        tier: ctx.tier,
        subscriptionStatus: ctx.subscriptionStatus,
        trialExpired: false,
      };
    }

    if (ctx.trialExpired) {
      // Trial over — need active paid plan
      const sub = await prisma.billingSubscription.findUnique({
        where: { organizationId },
        select: { status: true, tier: true },
      });
      if (!sub || sub.status === "canceled" || sub.status === "unpaid") {
        return {
          active: false,
          reason: "Trial expired. Upgrade to continue.",
          tier: PricingTier.FREE,
          subscriptionStatus: ctx.subscriptionStatus,
          trialExpired: true,
        };
      }
      if (sub.status === "past_due") {
        return {
          active: false,
          reason: "Payment past due. Update your billing to continue.",
          tier: coerceTier(sub.tier),
          subscriptionStatus: ctx.subscriptionStatus,
          trialExpired: true,
        };
      }
      return {
        active: true,
        tier: coerceTier(sub.tier),
        subscriptionStatus: ctx.subscriptionStatus,
        trialExpired: true,
      };
    }

    // Non-trial status (active/expired/suspended) — check billing sub status
    const sub = await prisma.billingSubscription.findUnique({
      where: { organizationId },
      select: { status: true, tier: true },
    });
    if (sub && (sub.status === "canceled" || sub.status === "unpaid")) {
      return {
        active: false,
        reason: "Subscription is inactive. Re-activate to continue.",
        tier: coerceTier(sub.tier),
        subscriptionStatus: ctx.subscriptionStatus,
        trialExpired: false,
      };
    }

    return {
      active: true,
      tier: ctx.tier,
      subscriptionStatus: ctx.subscriptionStatus,
      trialExpired: false,
    };
  } catch (error) {
    console.error("[feature-gates] requireActiveSubscription error, failing open:", error);
    return {
      active: true,
      tier: PricingTier.ENTERPRISE,
      subscriptionStatus: "trial",
      trialExpired: false,
    };
  }
}

// ----------------------------------------------------------------------------
// Trial status (for UI banners)
// ----------------------------------------------------------------------------

export type TrialStatus = {
  inTrial: boolean;
  daysRemaining: number;
  trialEndDate: Date | null;
  expired: boolean;
};

/**
 * Returns trial info for the dashboard banner.
 * daysRemaining is clamped to >= 0; negative values indicate expired trial.
 */
export async function getTrialStatus(organizationId: string): Promise<TrialStatus> {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionStatus: true, trialEndDate: true },
    });

    if (!org || !org.trialEndDate) {
      return { inTrial: false, daysRemaining: 0, trialEndDate: null, expired: false };
    }

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffMs = org.trialEndDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / msPerDay));
    const isTrialStatus = (org.subscriptionStatus || "trial") === "trial";
    const expired = isTrialStatus && diffMs <= 0;
    const inTrial = isTrialStatus && !expired;

    return {
      inTrial,
      daysRemaining,
      trialEndDate: org.trialEndDate,
      expired,
    };
  } catch (error) {
    console.error("[feature-gates] getTrialStatus error:", error);
    return { inTrial: false, daysRemaining: 0, trialEndDate: null, expired: false };
  }
}

// ----------------------------------------------------------------------------
// Standard API error responses (used by write endpoints)
// ----------------------------------------------------------------------------

export type LimitReachedResponse = {
  error: string;
  limit: number;
  current: number;
  tier: string;
  upgradeUrl: string;
};

export function buildLimitReachedResponse(
  limitKey: TierLimitKey,
  check: LimitCheck,
): LimitReachedResponse {
  const tierName = getTierConfig(check.tier).name;
  return {
    error: `Plan limit reached for ${humanizeLimitKey(limitKey)}`,
    limit: check.limit,
    current: check.current,
    tier: tierName,
    upgradeUrl: "/settings/billing",
  };
}

function humanizeLimitKey(key: TierLimitKey): string {
  switch (key) {
    case "maxBeneficiaries": return "beneficiaries";
    case "maxGrants": return "grants";
    case "maxExpensesPerMonth": return "monthly expenses";
    case "maxCardsPerMonth": return "monthly cards issued";
    case "maxTeamMembers": return "team members";
    case "maxStorageMB": return "storage (MB)";
    default: return key;
  }
}

// ----------------------------------------------------------------------------
// Current-period helpers (for monthly counters)
// ----------------------------------------------------------------------------

/**
 * Returns YYYY-MM string for the current period.
 */
export function getCurrentPeriod(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
