// One-shot cleanup: the live DB has fa_mock_* placeholder ids for
// Organization.stripeFinancialAccountId that would fail any real Stripe
// Treasury call. Replace ORG-00001 with the real platform Financial
// Account id and null out every other mock value so the onboarding flow
// can re-provision real ones the next time.
//
// Real Financial Account id confirmed in STRIPE.md:
//   fa_65UQyXBXwWXIKG7eb8f16UQxkH04SQjPoQwtpHcXKEaX5M
// Account holder: Kishana Stiner, Fifth Third Bank N.A.

import { prisma } from "../lib/db";

const REAL_PLATFORM_FA =
  "fa_65UQyXBXwWXIKG7eb8f16UQxkH04SQjPoQwtpHcXKEaX5M";

async function main() {
  console.log("\n=== Before ===");
  const before = await prisma.$queryRawUnsafe<
    Array<{ orgCode: string | null; name: string; stripeFinancialAccountId: string | null }>
  >(`
    SELECT "orgCode", name, "stripeFinancialAccountId"
    FROM "Organization"
    ORDER BY "orgCode";
  `);
  console.table(before);

  // ORG-00001 → real Financial Account id
  const updateReal = await prisma.$executeRawUnsafe(
    `UPDATE "Organization"
     SET "stripeFinancialAccountId" = $1
     WHERE "orgCode" = 'ORG-00001';`,
    REAL_PLATFORM_FA,
  );
  console.log(`ORG-00001 updated: ${updateReal} row(s)`);

  // Any other fa_mock_* values → NULL (so re-onboarding provisions real ones)
  const clearedMocks = await prisma.$executeRawUnsafe(
    `UPDATE "Organization"
     SET "stripeFinancialAccountId" = NULL
     WHERE "stripeFinancialAccountId" LIKE 'fa_mock_%';`,
  );
  console.log(`Mock fa_* cleared: ${clearedMocks} row(s)`);

  console.log("\n=== After ===");
  const after = await prisma.$queryRawUnsafe<
    Array<{ orgCode: string | null; name: string; stripeFinancialAccountId: string | null }>
  >(`
    SELECT "orgCode", name, "stripeFinancialAccountId"
    FROM "Organization"
    ORDER BY "orgCode";
  `);
  console.table(after);
}

main().finally(() => prisma.$disconnect());
