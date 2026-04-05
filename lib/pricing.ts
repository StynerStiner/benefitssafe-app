// BenefitsSafe pricing tiers, feature flags, and tier limits.
// Tier selection drives feature gating, rate limits, and UI entitlements.
// DO NOT confuse this with `model Subscription` in schema.prisma — that model
// tracks vendor SaaS subscriptions (Adobe, Netflix) paid on behalf of
// beneficiaries and is completely separate from BenefitsSafe billing.

export enum PricingTier {
  FREE = "free",
  SEED = "seed",
  CORE = "core",
  NETWORK = "network",
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
    name: "Community",
    price: 0,
    stripePriceId: null,
    limits: {
      maxBeneficiaries: 10,
      maxGrants: 5,
      maxExpensesPerMonth: 50,
      maxCardsPerMonth: 10,
      maxTeamMembers: 3,
      maxStorageMB: 200,
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
  [PricingTier.SEED]: {
    name: "Seed",
    price: 49,
    stripePriceId: process.env.STRIPE_PRICE_SEED || null,
    limits: {
      maxBeneficiaries: 50,
      maxGrants: 15,
      maxExpensesPerMonth: 200,
      maxCardsPerMonth: 50,
      maxTeamMembers: 10,
      maxStorageMB: 1000,
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
  [PricingTier.CORE]: {
    name: "Core",
    price: 99,
    stripePriceId: process.env.STRIPE_PRICE_CORE || null,
    limits: {
      maxBeneficiaries: 200,
      maxGrants: 50,
      maxExpensesPerMonth: 1000,
      maxCardsPerMonth: 200,
      maxTeamMembers: 25,
      maxStorageMB: 4000,
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
  [PricingTier.NETWORK]: {
    name: "Network",
    price: 199,
    stripePriceId: process.env.STRIPE_PRICE_NETWORK || null,
    limits: {
      maxBeneficiaries: 500,
      maxGrants: 100,
      maxExpensesPerMonth: 2500,
      maxCardsPerMonth: 500,
      maxTeamMembers: 75,
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
    price: 399,
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

// Legacy tier names that may exist in the database from the prior pricing scheme.
// Keep these fallbacks so existing BillingSubscription rows continue to resolve.
const LEGACY_TIER_ALIASES: Record<string, PricingTier> = {
  starter: PricingTier.SEED,
  growth: PricingTier.CORE,
  professional: PricingTier.NETWORK,
};

/**
 * Coerce a string (e.g. org.billingSubscription.tier) into a valid PricingTier.
 * Accepts both current names and legacy names from the pre-rename scheme.
 * Defaults to FREE if the string does not match any known tier.
 */
export function coerceTier(tier: string | null | undefined): PricingTier {
  if (!tier) return PricingTier.FREE;
  const match = Object.values(PricingTier).find((t) => t === tier);
  if (match) return match as PricingTier;
  const legacy = LEGACY_TIER_ALIASES[tier];
  if (legacy) return legacy;
  return PricingTier.FREE;
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
  PricingTier.SEED,
  PricingTier.CORE,
  PricingTier.NETWORK,
  PricingTier.ENTERPRISE,
] as const;

export function isUpgrade(from: PricingTier, to: PricingTier): boolean {
  return TIER_ORDER.indexOf(to) > TIER_ORDER.indexOf(from);
}

export function isDowngrade(from: PricingTier, to: PricingTier): boolean {
  return TIER_ORDER.indexOf(to) < TIER_ORDER.indexOf(from);
}
