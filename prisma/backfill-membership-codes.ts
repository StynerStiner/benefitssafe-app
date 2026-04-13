// Backfill / repair OrganizationMembership.memberCode values.
//
// Run with:  npx tsx prisma/backfill-membership-codes.ts
//
// This one-time script fixes three classes of wrong data left behind by the
// previous inline code generators:
//
//   1. Missing code    — memberCode IS NULL  (never got one assigned)
//   2. Wrong prefix    — a beneficiary or vendor was given a "TM-" code
//   3. (implicitly) leaves correctly-prefixed codes untouched, so nothing
//      that a user has already seen gets renumbered unnecessarily.
//
// The script processes memberships in joinedAt order so early rows get the
// lower sequence numbers, matching the "first joined = lowest number" intuition.
// It calls the shared `generateMembershipCode()` util one-at-a-time, which
// re-reads the live state each call, so sequences progress correctly.
//
// SAFE TO RE-RUN. If every row is already correct, output is just counts.
//
// NOT WRAPPED IN A TRANSACTION — each row is updated individually so a
// partial failure leaves the DB in a mixed state. Re-run to resume.

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateMembershipCode, getPrefixForRole } from "../lib/utils/membership-code";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter }) as PrismaClient;

async function main() {
  const all = await prisma.organizationMembership.findMany({
    select: {
      id: true,
      organizationId: true,
      role: true,
      memberCode: true,
      joinedAt: true,
    },
    orderBy: { joinedAt: "asc" },
  });

  console.log(`Scanning ${all.length} memberships...\n`);

  let fixed = 0;
  let alreadyCorrect = 0;
  let skippedEmpty = 0;

  for (const m of all) {
    const correctPrefix = getPrefixForRole(m.role);
    const isCorrect =
      m.memberCode !== null &&
      m.memberCode.startsWith(correctPrefix);

    if (isCorrect) {
      alreadyCorrect++;
      continue;
    }

    const newCode = await generateMembershipCode(
      prisma,
      m.organizationId,
      m.role,
    );

    // Collision guard — if the generated code already exists in this org for
    // some reason (shouldn't, but be defensive), skip rather than crash.
    const collision = await prisma.organizationMembership.findUnique({
      where: { memberCode: newCode },
      select: { id: true },
    });
    if (collision && collision.id !== m.id) {
      console.warn(`  SKIP ${m.id}: generated ${newCode} collides with ${collision.id}`);
      skippedEmpty++;
      continue;
    }

    await prisma.organizationMembership.update({
      where: { id: m.id },
      data: { memberCode: newCode },
    });

    console.log(
      `  FIX ${m.id.slice(0, 8)}  role=${m.role.padEnd(20)}  ${String(m.memberCode ?? "NULL").padEnd(18)} -> ${newCode}`,
    );
    fixed++;
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`  Fixed:           ${fixed}`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Skipped:         ${skippedEmpty}`);
  console.log("=".repeat(60));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
