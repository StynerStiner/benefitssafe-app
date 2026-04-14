// End-to-end verification: run the new membership-based queries against
// the live DB for both orgs (ORG-00001, ORG-00002) and confirm we get the
// expected beneficiary/team counts. Compares against the legacy
// User.organizationId queries to prove parity for current single-org data.

import { prisma } from "../lib/db";

async function compareForOrg(orgId: string, label: string) {
  console.log(`\n=== ${label} (${orgId}) ===`);

  // Legacy beneficiary count: User.organizationId
  const legacyBeneCount = await prisma.user.count({
    where: { organizationId: orgId, role: "beneficiary", isActive: true },
  });
  // New beneficiary count: OrganizationMembership
  const newBeneCount = await prisma.organizationMembership.count({
    where: { organizationId: orgId, role: "beneficiary", status: "active" },
  });
  console.log(`  Beneficiaries  legacy=${legacyBeneCount}  new=${newBeneCount}  ${legacyBeneCount === newBeneCount ? "✓" : "✗ MISMATCH"}`);

  // Team list (everything except beneficiary/vendor)
  const teamRoles = ["nonprofit_admin", "nonprofit_staff", "cpa", "auditor", "attorney", "grant_officer"] as const;
  const legacyTeamCount = await prisma.user.count({
    where: { organizationId: orgId, role: { in: teamRoles } },
  });
  const newTeamCount = await prisma.organizationMembership.count({
    where: { organizationId: orgId, role: { in: teamRoles as unknown as string[] }, status: "active" },
  });
  console.log(`  Team           legacy=${legacyTeamCount}  new=${newTeamCount}  ${legacyTeamCount === newTeamCount ? "✓" : "✗ MISMATCH"}`);

  // Sample one beneficiary detail end-to-end
  const sampleMembership = await prisma.organizationMembership.findFirst({
    where: { organizationId: orgId, role: "beneficiary", status: "active" },
    select: {
      id: true,
      memberCode: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          // The new detail GET filters grants/expenses by viewing org id —
          // simulate that here too.
          grants: {
            where: { archivedAt: null, organizationId: orgId },
            select: { id: true, name: true, organizationId: true },
          },
        },
      },
    },
  });
  if (sampleMembership) {
    console.log(`  Sample bene: ${sampleMembership.user.email} memberCode=${sampleMembership.memberCode} grants=${sampleMembership.user.grants.length}`);
    // Critical leak check: every returned grant must have organizationId === orgId
    const leak = sampleMembership.user.grants.find(g => g.organizationId !== orgId);
    if (leak) console.log(`  ✗ CROSS-ORG GRANT LEAK: grant ${leak.id} has organizationId ${leak.organizationId}`);
  }
}

async function main() {
  await compareForOrg("cmncq0p3e00008qba6uomou5j", "ORG-00001 BenefitsSafe Demo");
  await compareForOrg("cmncvh1tk0000iubanzlns5dm", "ORG-00002 BenefitsSafe Development");

  // Final cross-check: count of grants whose beneficiary belongs to a
  // *different* org than the grant. Should be 0 today, but worth spotting
  // any drift after multi-org goes live.
  console.log("\n=== Cross-org grant assignments (sanity) ===");
  const xOrgGrants = await prisma.$queryRawUnsafe<
    Array<{ grant_id: string; grant_org: string; bene_email: string; bene_org: string }>
  >(`
    SELECT g.id as grant_id, g."organizationId" as grant_org,
           u.email as bene_email, u."organizationId" as bene_org
    FROM "Grant" g
    JOIN "User" u ON u.id = g."beneficiaryId"
    WHERE g."beneficiaryId" IS NOT NULL
      AND g."organizationId" != u."organizationId"
    LIMIT 10;
  `);
  console.log(`  Grants where grant.organizationId != user.organizationId: ${xOrgGrants.length}`);
  if (xOrgGrants.length > 0) console.table(xOrgGrants);
}

main().finally(() => prisma.$disconnect());
