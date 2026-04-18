// @ts-nocheck
// Hybrid card-issuance helpers.
//
// Background: the BenefitsSafe platform account (acct_1THZmv1lmD1ohIWk)
// is approved for Stripe Issuing + Treasury (see STRIPE.md). Nonprofits'
// connected accounts are Custom Connect accounts that require a separate
// per-account capability grant from Stripe for `card_issuing`. Today,
// no connected account has been granted card_issuing yet.
//
// Rather than block every tenant behind Stripe's underwriting pipeline,
// this module gives the app a capability-aware routing layer:
//
//   - If an org's connected account has card_issuing active → issue
//     the card on that connected account (per-tenant isolation, own
//     Treasury Financial Account, FDIC pass-through).
//   - Otherwise → fall back to issuing on the platform account, tagging
//     every card with metadata.organizationId so the webhook + reports
//     can still attribute spend per-tenant.
//
// When Stripe grants card_issuing on a tenant's connected account, the
// next card issued for that tenant automatically lands on the connected
// account without any code change or manual migration — older cards
// already stored in the DB keep their original `issuingMode` and
// continue to be updated on whichever account owns them.

import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
} from "@/lib/stripe-circuit";

export type IssuingMode = "connected" | "platform";

export interface IssuingAccountResolution {
  /** The stripeAccount id to pass to Stripe Issuing calls, or null for platform. */
  accountId: string | null;
  /** Which account the resulting card lives on. */
  mode: IssuingMode;
}

/**
 * Resolve where a new card for this org should be created.
 *
 * Called once per card issuance. Makes one live Stripe API call to check
 * the connected account's current capabilities — inexpensive at card-
 * issuance volume, and the live check means capability grants take
 * effect immediately without a cache-invalidation step.
 */
export async function getIssuingAccount(
  orgStripeAccountId: string | null,
): Promise<IssuingAccountResolution> {
  if (!orgStripeAccountId) {
    return { accountId: null, mode: "platform" };
  }

  try {
    const account = await stripeCircuit.run(
      "lib/stripe-helpers:getIssuingAccount:stripe.accounts.retrieve",
      { mode: "read" },
      () => stripe.accounts.retrieve(orgStripeAccountId),
    );
    if (account.capabilities?.card_issuing === "active") {
      return { accountId: orgStripeAccountId, mode: "connected" };
    }
    return { accountId: null, mode: "platform" };
  } catch (err) {
    // Pattern β: bubble circuit errors to caller so route's outer catch
    // can surface 503 + Retry-After. Stripe-returned errors continue to
    // fall through to the platform-mode fallback below.
    if (err instanceof CircuitOpenError || err instanceof CircuitTimeoutError) throw err;
    // If the retrieve itself fails (network, revoked account, etc.),
    // fall back to platform so card issuance isn't blocked on a
    // diagnostic call.
    console.error("[stripe-helpers] accounts.retrieve failed:", err);
    return { accountId: null, mode: "platform" };
  }
}

/**
 * Build the RequestOptions object for an existing card's update/reveal
 * path. The card's mode was decided at creation time and stored on the
 * VirtualCard row — we must honor it for lifecycle operations regardless
 * of the connected account's current capability state.
 */
export function stripeOptsForCard(
  card: { issuingMode: string | null },
  orgStripeAccountId: string | null,
): Record<string, string> {
  if (card.issuingMode === "connected" && orgStripeAccountId) {
    return { stripeAccount: orgStripeAccountId };
  }
  return {};
}
