// BenefitsSafe pricing tiers, feature flags, and tier limits.
// Tier selection drives feature gating, rate limits, and UI entitlements.
// DO NOT confuse this with `model Subscription` in schema.prisma — that model
// tracks vendor SaaS subscriptions (Adobe, Netflix) paid on behalf of
// beneficiaries and is completely separate from BenefitsSafe billing.

export enum PricingTier {
  FREE = "free",
  STARTER = "starter",
  GROWTH = "growth",
  PROFESSIONAL = "professional",
  ENTERPRISE = "enterprise",
}

export type TierLimits = {
  maxBeneficiaries: number;
  maxGrants: number;
  maxExpensesPerMonth: number;
  maxCardsPerMonth: number;
  maxTeamMembers: number;
  maxStorageMB: number;
};

export type TierFeatures = {
  composioWorkflows: boolean;
  sentinelWatchdog: boolean;
  sentinelCompliance: boolean;
  sentinelReporter: boolean;
  customMCCRules: boolean;
  prioritySupport: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
};

export type TierConfigItem = {
  name: string;
  price: number;
  stripePriceId: string | null;
  limits: TierLimits;
  features: TierFeatures;
};

export type TierLimitKey = keyof TierLimits;
export type TierFeatureKey = keyof TierFeatures;

// -1 means unlimited
export const UNLIMITED = -1 as const;

export const TIER_CONFIG: Record<PricingTier, TierConfigItem> = {
  [PricingTier.FREE]: {
    name: "Free",
    price: 0,
    stripePriceId: null,
    limits: {
      maxBeneficiaries: 5,
      maxGrants: 2,
      maxExpensesPerMonth: 20,
      maxCardsPerMonth: 5,
      maxTeamMembers: 3,
      maxStorageMB: 100,
    },
    features: {
      composioWorkflows: false,
      sentinelWatchdog: false,
      sentinelCompliance: false,
      sentinelReporter: false,
      customMCCRules: false,
      prioritySupport: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  [PricingTier.STARTER]: {
    name: "Starter",
    price: 49,
    stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
    limits: {
      maxBeneficiaries: 25,
      maxGrants: 5,
      maxExpensesPerMonth: 100,
      maxCardsPerMonth: 25,
      maxTeamMembers: 5,
      maxStorageMB: 500,
    },
    features: {
      composioWorkflows: false,
      sentinelWatchdog: false,
      sentinelCompliance: false,
      sentinelReporter: false,
      customMCCRules: true,
      prioritySupport: false,
      apiAccess: false,
      whiteLabel: false,
    },
  },
  [PricingTier.GROWTH]: {
    name: "Growth",
    price: 149,
    stripePriceId: process.env.STRIPE_PRICE_GROWTH || null,
    limits: {
      maxBeneficiaries: 100,
      maxGrants: 20,
      maxExpensesPerMonth: 500,
      maxCardsPerMonth: 100,
      maxTeamMembers: 15,
      maxStorageMB: 2000,
    },
    features: {
      composioWorkflows: true,
      sentinelWatchdog: true,
      sentinelCompliance: true,
      sentinelReporter: false,
      customMCCRules: true,
      prioritySupport: false,
      apiAccess: true,
      whiteLabel: false,
    },
  },
  [PricingTier.PROFESSIONAL]: {
    name: "Professional",
    price: 349,
    stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL || null,
    limits: {
      maxBeneficiaries: 500,
      maxGrants: 50,
      maxExpensesPerMonth: 2000,
      maxCardsPerMonth: 500,
      maxTeamMembers: 50,
      maxStorageMB: 10000,
    },
    features: {
      composioWorkflows: true,
      sentinelWatchdog: true,
      sentinelCompliance: true,
      sentinelReporter: true,
      customMCCRules: true,
      prioritySupport: true,
      apiAccess: true,
      whiteLabel: false,
    },
  },
  [PricingTier.ENTERPRISE]: {
    name: "Enterprise",
    price: 599,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || null,
    limits: {
      maxBeneficiaries: UNLIMITED,
      maxGrants: UNLIMITED,
      maxExpensesPerMonth: UNLIMITED,
      maxCardsPerMonth: UNLIMITED,
      maxTeamMembers: UNLIMITED,
      maxStorageMB: UNLIMITED,
    },
    features: {
      composioWorkflows: true,
      sentinelWatchdog: true,
      sentinelCompliance: true,
      sentinelReporter: true,
      customMCCRules: true,
      prioritySupport: true,
      apiAccess: true,
      whiteLabel: true,
    },
  },
};

// ----------------------------------------------------------------------------
// Helper functions
// ----------------------------------------------------------------------------

/**
 * Coerce a string (e.g. org.billingSubscription.tier) into a valid PricingTier.
 * Defaults to FREE if the string does not match any known tier.
 */
export function coerceTier(tier: string | null | undefined): PricingTier {
  if (!tier) return PricingTier.FREE;
  const match = Object.values(PricingTier).find((t) => t === tier);
  return (match as PricingTier | undefined) ?? PricingTier.FREE;
}

export function getTierConfig(tier: PricingTier): TierConfigItem {
  return TIER_CONFIG[tier];
}

export function getTierLimits(tier: PricingTier): TierLimits {
  return TIER_CONFIG[tier].limits;
}

export function getTierFeatures(tier: PricingTier): TierFeatures {
  return TIER_CONFIG[tier].features;
}

export function hasFeature(tier: PricingTier, feature: TierFeatureKey): boolean {
  return TIER_CONFIG[tier].features[feature];
}

/**
 * Returns true if currentCount is strictly below the tier's limit for `limitKey`.
 * A limit value of -1 (UNLIMITED) always returns true.
 */
export function isWithinLimit(
  tier: PricingTier,
  limitKey: TierLimitKey,
  currentCount: number,
): boolean {
  const limit = TIER_CONFIG[tier].limits[limitKey];
  if (limit === UNLIMITED) return true;
  return currentCount < limit;
}

/**
 * Returns the numeric limit for a tier + limitKey.
 * -1 means unlimited.
 */
export function getLimit(tier: PricingTier, limitKey: TierLimitKey): number {
  return TIER_CONFIG[tier].limits[limitKey];
}

/**
 * Returns usage as a 0..1 fraction of the limit.
 * Returns 0 for unlimited tiers.
 */
export function getUsagePercentage(
  tier: PricingTier,
  limitKey: TierLimitKey,
  currentCount: number,
): number {
  const limit = TIER_CONFIG[tier].limits[limitKey];
  if (limit === UNLIMITED || limit <= 0) return 0;
  return Math.min(1, currentCount / limit);
}

/**
 * Ordered tier list for comparison / upgrade logic (low to high).
 */
export const TIER_ORDER: readonly PricingTier[] = [
  PricingTier.FREE,
  PricingTier.STARTER,
  PricingTier.GROWTH,
  PricingTier.PROFESSIONAL,
  PricingTier.ENTERPRISE,
] as const;

export function isUpgrade(from: PricingTier, to: PricingTier): boolean {
  return TIER_ORDER.indexOf(to) > TIER_ORDER.indexOf(from);
}

export function isDowngrade(from: PricingTier, to: PricingTier): boolean {
  return TIER_ORDER.indexOf(to) < TIER_ORDER.indexOf(from);
}
