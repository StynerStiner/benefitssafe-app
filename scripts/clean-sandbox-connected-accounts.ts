// One-shot cleanup: null out Organization.stripeAccountId values.
//
// Background: the two values currently stored in production
//   - acct_1TJJ5b1J7fqo5LRe (ORG-00001)
//   - acct_1THfPT0SRavKoASv (ORG-00002)
// were created against the SANDBOX Stripe account (sk_test_*) and do
// not exist under the LIVE Stripe account (sk_live_*). Every production
// Stripe API call routed through them fails with "does not have access
// to account or that account does not exist." Null them out so the
// hybrid issuance logic cleanly falls through to platform mode, and so
// the next live Connect onboarding run can provision real live ids.
//
// Deliberately leaves Organization.stripeFinancialAccountId untouched —
// Treasury status is still being confirmed with Stripe and ORG-00001's
// FA id is needed for the pending balance-precheck path.
//
// Safe to re-run: WHERE clause no-ops once values are null.

import { prisma } from "../lib/db";

async function main() {
  console.log("\n=== Before ===");
  const before = await prisma.$queryRawUnsafe<
    Array<{
      orgCode: string | null;
      name: string;
      stripeAccountId: string | null;
      stripeFinancialAccountId: string | null;
    }>
  >(`
    SELECT "orgCode", name, "stripeAccountId", "stripeFinancialAccountId"
    FROM "Organization"
    ORDER BY "orgCode";
  `);
  console.table(before);

  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "Organization"
     SET "stripeAccountId" = NULL
     WHERE "stripeAccountId" IS NOT NULL;`,
  );
  console.log(`\nNulled stripeAccountId on ${updated} row(s).`);

  console.log("\n=== After ===");
  const after = await prisma.$queryRawUnsafe<
    Array<{
      orgCode: string | null;
      name: string;
      stripeAccountId: string | null;
      stripeFinancialAccountId: string | null;
    }>
  >(`
    SELECT "orgCode", name, "stripeAccountId", "stripeFinancialAccountId"
    FROM "Organization"
    ORDER BY "orgCode";
  `);
  console.table(after);

  // Sanity: every stripeAccountId should be NULL
  const remaining = after.filter((r) => r.stripeAccountId !== null);
  if (remaining.length > 0) {
    console.error(
      `\nFAIL: ${remaining.length} row(s) still have a non-null stripeAccountId`,
    );
    process.exitCode = 1;
  } else {
    console.log("\nOK: all Organization.stripeAccountId values are NULL.");
  }
}

main().finally(() => prisma.$disconnect());
