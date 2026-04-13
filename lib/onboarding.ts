// Onboarding checklist derivation.
//
// Every step's completion is computed from live DB state — we do NOT track
// per-step booleans. This keeps the checklist honest: if an admin deletes all
// their beneficiaries, "Add your first beneficiary" becomes incomplete again.
//
// Used by GET /api/onboarding.

import type { PrismaClient } from "@/lib/generated/prisma/client";

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
  optional?: boolean;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  requiredCount: number;
  requiredCompletedCount: number;
  isComplete: boolean;
}

type PrismaLike = Pick<
  PrismaClient,
  "organization" | "organizationMembership" | "grant" | "disbursementPolicy"
>;

export async function computeOnboardingStatus(
  prisma: PrismaLike,
  organizationId: string,
): Promise<OnboardingStatus> {
  const [org, beneficiaryCount, grantCount, policyCount, teamCount] =
    await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          ein: true,
          address: true,
          phone: true,
          stripeAccountId: true,
          bankConnectedAt: true,
          logoUrl: true,
        },
      }),
      prisma.organizationMembership.count({
        where: { organizationId, role: "beneficiary" },
      }),
      prisma.grant.count({
        where: { organizationId, archivedAt: null },
      }),
      prisma.disbursementPolicy.count({
        where: { organizationId },
      }),
      // Team = all active memberships for non-beneficiary, non-vendor roles.
      // A freshly-signed-up admin counts as 1; we consider "team invited" as
      // meaning there's at least one OTHER team member in addition to them.
      prisma.organizationMembership.count({
        where: {
          organizationId,
          status: "active",
          role: {
            notIn: ["beneficiary", "vendor", "family_member"],
          },
        },
      }),
    ]);

  const orgProfileComplete = Boolean(
    org && org.ein && org.address && org.phone,
  );
  const bankConnected = Boolean(
    org && org.stripeAccountId && org.bankConnectedAt,
  );
  const orgLogoUploaded = Boolean(org?.logoUrl);

  const steps: OnboardingStep[] = [
    {
      key: "orgProfile",
      label: "Complete your organization profile",
      description: "Add your EIN, address, and phone number.",
      href: "/org-settings",
      completed: orgProfileComplete,
    },
    {
      key: "bankConnected",
      label: "Connect your bank account",
      description:
        "Connect via Stripe so you can fund virtual cards for beneficiaries.",
      href: "/org-settings",
      completed: bankConnected,
    },
    {
      key: "firstBeneficiary",
      label: "Add your first beneficiary",
      description: "Beneficiaries are the people your grants will serve.",
      href: "/beneficiaries",
      completed: beneficiaryCount > 0,
    },
    {
      key: "firstGrant",
      label: "Create your first grant",
      description: "Grants hold the restricted funds you disburse.",
      href: "/grants",
      completed: grantCount > 0,
    },
    {
      key: "disbursementPolicy",
      label: "Set up a disbursement policy",
      description: "Define spending rules and approval thresholds.",
      href: "/policies",
      completed: policyCount > 0,
    },
    {
      key: "teamMember",
      label: "Invite a team member",
      description: "Invite staff, auditors, or compliance officers.",
      href: "/team",
      completed: teamCount > 1,
      optional: true,
    },
    {
      key: "orgLogo",
      label: "Upload your organization logo",
      description: "Your logo appears in the sidebar and on receipts.",
      href: "/org-settings",
      completed: orgLogoUploaded,
      optional: true,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const required = steps.filter((s) => !s.optional);
  const requiredCompletedCount = required.filter((s) => s.completed).length;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    requiredCount: required.length,
    requiredCompletedCount,
    isComplete: requiredCompletedCount === required.length,
  };
}
