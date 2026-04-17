// Bootstrap: Organization upsert -> existing seed -> admin@ + membership upsert
// Wraps scripts/seed-test-users.ts without modifying it.
// Idempotent: re-running does not throw on existing rows.

import "dotenv/config";
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";
import { generateMembershipCode } from "../lib/utils/membership-code";

const ORG_ID = "cmncq0p3e00008qba6uomou5j";
const ORG_NAME = "BenefitsSafe Development";
const ADMIN_EMAIL = "admin@benefitssafe.com";
const PASSWORD = "TestDev2024!";

async function main() {
  // Phase 1: Organization upsert (must precede the seed so User FK resolves)
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: ORG_NAME,
      subscriptionStatus: "trial",
    },
  });
  console.log(`[phase 1] Organization ready: ${org.name} (${org.id})`);

  // Phase 2: Run the existing seed unchanged as a subprocess.
  // Isolation rationale (FM-6): subprocess opens its own prisma client,
  // manages its own connection, and exits cleanly before wrapper continues.
  console.log("[phase 2] Running scripts/seed-test-users.ts...");
  execSync("npx tsx scripts/seed-test-users.ts", { stdio: "inherit" });

  // Phase 3: admin@ user upsert. Seed does not create this email.
  // bcrypt rounds = 10 to match seed-test-users.ts:111.
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      firstName: "Admin",
      lastName: "User",
      passwordHash,
      role: "nonprofit_admin",
      organizationId: ORG_ID,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`[phase 3] ${ADMIN_EMAIL} ready: ${admin.id}`);

  // Phase 4: admin@ membership upsert. Seed creates memberships for the
  // 11 emails it touches, but admin@ is not in that list, so we must add
  // one here. Uses the @@unique([userId, organizationId]) composite key.
  const existingMembership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: admin.id, organizationId: ORG_ID } },
  });
  if (existingMembership) {
    console.log(`[phase 4] Membership already exists: ${existingMembership.id}`);
  } else {
    const memberCode = await generateMembershipCode(prisma, ORG_ID, "nonprofit_admin");
    const membership = await prisma.organizationMembership.create({
      data: {
        userId: admin.id,
        organizationId: ORG_ID,
        role: "nonprofit_admin",
        memberCode,
        status: "active",
        isDefaultOrg: true,
      },
    });
    console.log(`[phase 4] Membership created: ${membership.id} (${memberCode})`);
  }

  console.log("[done] Bootstrap complete");
}

main()
  .catch((e) => {
    console.error("BOOTSTRAP FAILED:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
