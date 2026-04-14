// Centralized membership code generator.
// Format: {PREFIX}{orgSeq}-{memberSeq}  e.g. "BS-0001-00005"
//   - orgSeq  = 4-digit sequence from Organization.orgCode ("ORG-0001" -> "0001")
//   - memberSeq = 5-digit per-(org, prefix) sequence
//
// Prefix mapping (12 codebase roles -> 4 prefixes):
//   - "beneficiary" / "family_member"   -> BS- (Beneficiary)
//   - "vendor"                          -> VN- (Vendor)
//   - "platform_admin" / "compliance_officer" / "support_agent" /
//     "billing_admin"                   -> BF- (BenefitsSafe internal staff)
//   - everything else (nonprofit_admin, nonprofit_staff, cpa, auditor,
//     attorney, grant_officer, member, ...) -> TM- (nonprofit Team Member)
//
// The BF- prefix is the ONLY signal in the human-readable code that
// distinguishes a BenefitsSafe employee from a nonprofit's own team.
// Without it, TM-00001-00010 in the platform org and TM-00002-00010 in a
// nonprofit org are indistinguishable in support tickets, exports, and
// audit trails.
//
// This is the ONLY place membership codes are generated. Every API route
// that creates an OrganizationMembership must call generateMembershipCode().

import type { PrismaClient } from "@/lib/generated/prisma/client";

export type MembershipCodePrefix = "BS-" | "VN-" | "TM-" | "BF-";

export function getPrefixForRole(role: string): MembershipCodePrefix {
  switch (role) {
    case "beneficiary":
    case "family_member":
      return "BS-";
    case "vendor":
      return "VN-";
    case "platform_admin":
    case "compliance_officer":
    case "support_agent":
    case "billing_admin":
      return "BF-";
    default:
      return "TM-";
  }
}

// Minimal structural type covering both the singleton prisma client and
// transaction clients — we only need findUnique + findMany.
type PrismaLike = Pick<PrismaClient, "organization" | "organizationMembership">;

/**
 * Generate a unique memberCode for a new OrganizationMembership.
 *
 * Scans existing memberCodes in this org matching the same prefix+orgSeq,
 * takes the max numeric suffix, and returns {prefix}{orgSeq}-{max+1}.
 *
 * Concurrency note: this is not race-free. Two concurrent invites in the
 * same org MAY generate the same code and collide on the `@unique`
 * constraint. Callers should catch P2002 and retry if that matters. The
 * previous inline generators had the exact same race.
 */
export async function generateMembershipCode(
  prisma: PrismaLike,
  organizationId: string,
  role: string,
): Promise<string> {
  const prefix = getPrefixForRole(role);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { orgCode: true },
  });

  // Fall back to "0000" if the org has no orgCode (pre-launch data without
  // an assigned ORG- sequence yet).
  const match = org?.orgCode?.match(/ORG-(\d+)/);
  const orgSeq = match?.[1] ?? "0000";

  const existing = await prisma.organizationMembership.findMany({
    where: {
      organizationId,
      memberCode: { startsWith: `${prefix}${orgSeq}-` },
    },
    select: { memberCode: true },
  });

  let maxSeq = 0;
  for (const m of existing) {
    const tail = m.memberCode?.split("-").pop();
    const n = tail ? parseInt(tail, 10) : NaN;
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
  }

  const nextSeq = String(maxSeq + 1).padStart(5, "0");
  return `${prefix}${orgSeq}-${nextSeq}`;
}
