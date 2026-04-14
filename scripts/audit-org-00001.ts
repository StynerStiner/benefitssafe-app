// One-shot audit: what state is ORG-00001 actually in for card issuance?
// Checks DB columns + live Stripe account capabilities.

import { prisma } from "../lib/db";
import { stripe } from "../lib/stripe";

async function main() {
  console.log("\n=== DB: ORG-00001 ===");
  const org = await prisma.organization.findFirst({
    where: { orgCode: "ORG-00001" },
    select: {
      id: true,
      name: true,
      orgCode: true,
      stripeAccountId: true,
      stripeFinancialAccountId: true,
      stripeOriginPaymentMethodId: true,
      bankConnectedAt: true,
    },
  });
  console.log(JSON.stringify(org, null, 2));

  if (!org?.stripeAccountId) {
    console.log("No stripeAccountId — cannot check Stripe state.");
    return;
  }

  // 1. Retrieve the connected account and show capabilities + requirements
  console.log("\n=== STRIPE: accounts.retrieve(", org.stripeAccountId, ") ===");
  try {
    const account = await stripe.accounts.retrieve(org.stripeAccountId);
    console.log({
      id: account.id,
      type: account.type,
      country: account.country,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      capabilities: account.capabilities,
      requirements_currently_due: account.requirements?.currently_due,
      requirements_pending_verification: account.requirements?.pending_verification,
      requirements_eventually_due: account.requirements?.eventually_due,
      requirements_disabled_reason: account.requirements?.disabled_reason,
    });
  } catch (err) {
    console.log("accounts.retrieve failed:", err instanceof Error ? err.message : err);
  }

  // 2. If stripeFinancialAccountId set, retrieve the FA and its balance
  if (org.stripeFinancialAccountId) {
    console.log("\n=== STRIPE: treasury.financialAccounts.retrieve(", org.stripeFinancialAccountId, ") ===");
    try {
      const fa = await stripe.treasury.financialAccounts.retrieve(
        org.stripeFinancialAccountId,
        { stripeAccount: org.stripeAccountId },
      );
      console.log({
        id: fa.id,
        active_features: fa.active_features,
        pending_features: fa.pending_features,
        restricted_features: fa.restricted_features,
        status: fa.status,
        balance: fa.balance,
      });
    } catch (err) {
      console.log("financialAccounts.retrieve failed:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("\n(No stripeFinancialAccountId — skipping Treasury retrieve)");
  }

  // 3. Try listing Issuing cardholders on the connected account — confirms
  //    whether Issuing is actually usable there.
  console.log("\n=== STRIPE: issuing.cardholders.list (connected account) ===");
  try {
    const cardholders = await stripe.issuing.cardholders.list(
      { limit: 1 },
      { stripeAccount: org.stripeAccountId },
    );
    console.log({
      ok: true,
      count_returned: cardholders.data.length,
      has_more: cardholders.has_more,
    });
  } catch (err) {
    console.log("cardholders.list failed:", err instanceof Error ? err.message : err);
  }
}

main().finally(() => prisma.$disconnect());
