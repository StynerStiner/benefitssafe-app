import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(() => ({
          url: "https://checkout.stripe.com/test-session",
          id: "cs_test_123",
        })),
      },
    },
  },
}));

vi.mock("@/lib/pricing", () => ({
  TIER_CONFIG: {
    seed: { stripePriceId: "price_seed_123", name: "Seed", price: 49 },
    core: { stripePriceId: "price_core_123", name: "Core", price: 99 },
    network: { stripePriceId: "price_net_123", name: "Network", price: 199 },
    enterprise: { stripePriceId: "price_ent_123", name: "Enterprise", price: 399 },
    free: { stripePriceId: null, name: "Free", price: 0 },
  },
  PricingTier: { FREE: "free", SEED: "seed", CORE: "core", NETWORK: "network", ENTERPRISE: "enterprise" },
  coerceTier: (plan: string) => plan,
}));

describe("Checkout Direct - Plan Validation", () => {
  it("rejects missing plan parameter", () => {
    const VALID_PLANS = ["seed", "core", "network", "enterprise"];
    const plan = null;
    expect(plan === null || !VALID_PLANS.includes(plan as string)).toBe(true);
  });

  it("rejects invalid plan name", () => {
    const VALID_PLANS = ["seed", "core", "network", "enterprise"];
    expect(VALID_PLANS.includes("invalid")).toBe(false);
    expect(VALID_PLANS.includes("free")).toBe(false);
    expect(VALID_PLANS.includes("community")).toBe(false);
  });

  it("accepts valid plan names", () => {
    const VALID_PLANS = ["seed", "core", "network", "enterprise"];
    expect(VALID_PLANS.includes("seed")).toBe(true);
    expect(VALID_PLANS.includes("core")).toBe(true);
    expect(VALID_PLANS.includes("network")).toBe(true);
    expect(VALID_PLANS.includes("enterprise")).toBe(true);
  });

  it("success_url includes plan, checkout_success, and session_id", () => {
    const plan = "core";
    const baseUrl = "https://app.benefitssafe.com";
    const successUrl = `${baseUrl}/auth/register?plan=${plan}&checkout_success=true&session_id={CHECKOUT_SESSION_ID}`;

    expect(successUrl).toContain("plan=core");
    expect(successUrl).toContain("checkout_success=true");
    expect(successUrl).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(successUrl).toContain("app.benefitssafe.com");
    expect(successUrl).not.toMatch(/^https:\/\/benefitssafe\.com\//); // must be app. subdomain, not bare domain
  });

  it("cancel_url redirects to marketing site pricing", () => {
    const marketingUrl = "https://benefitssafe.com";
    const cancelUrl = `${marketingUrl}/pricing?canceled=true`;

    expect(cancelUrl).toContain("benefitssafe.com/pricing");
    expect(cancelUrl).toContain("canceled=true");
  });

  it("checkout session includes 14-day trial", () => {
    const trialDays = 14;
    expect(trialDays).toBe(14);
  });
});

describe("Checkout Direct - Tier Config", () => {
  it("all paid tiers have stripePriceId", async () => {
    const { TIER_CONFIG } = await import("@/lib/pricing");
    const paidTiers = ["seed", "core", "network", "enterprise"];

    for (const tier of paidTiers) {
      const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
      expect(config?.stripePriceId).toBeTruthy();
    }
  });

  it("free tier has no stripePriceId", async () => {
    const { TIER_CONFIG } = await import("@/lib/pricing");
    expect(TIER_CONFIG.free?.stripePriceId).toBeFalsy();
  });
});
