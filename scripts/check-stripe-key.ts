import { stripe } from "../lib/stripe";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY || "MISSING";
  console.log("Key starts with:", key.substring(0, 8));
  console.log("Key ends with:", key.substring(key.length - 4));
  console.log("Is sk_live:", key.startsWith("sk_live"));
  console.log("Is sk_test:", key.startsWith("sk_test"));
  console.log("Is rk_live:", key.startsWith("rk_live"));
  console.log("Is rk_test:", key.startsWith("rk_test"));

  try {
    const acct = await stripe.accounts.retrieve();
    console.log("\nAccount ID:", acct.id);
    console.log(
      "Business name:",
      acct.business_profile?.name || acct.settings?.dashboard?.display_name,
    );
    console.log("Country:", acct.country);
    console.log("Charges enabled:", acct.charges_enabled);
    console.log("Payouts enabled:", acct.payouts_enabled);
    console.log("Capabilities:", acct.capabilities);
  } catch (err: any) {
    console.log("\nStripe API error:", err.message);
  }
}

main().finally(() => process.exit());
