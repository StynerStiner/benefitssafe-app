// Single source of truth for which roles can be invited and by whom.
//
// ORG_INVITABLE_ROLES — invitable by nonprofit_admin (and platform_admin)
//   into a specific nonprofit organization.
//
// PLATFORM_INVITABLE_ROLES — invitable ONLY by platform_admin. These are
//   BenefitsSafe internal staff roles. nonprofit_admin must never be able
//   to create users with these roles, since doing so would let an org
//   manufacture cross-tenant visibility for its own employees.

import type { UserRole } from "@/lib/generated/prisma/client";

export const ORG_INVITABLE_ROLES = [
  "beneficiary",
  "nonprofit_staff",
  "vendor",
  "cpa",
  "auditor",
  "attorney",
  "grant_officer",
] as const satisfies readonly UserRole[];

export const PLATFORM_INVITABLE_ROLES = [
  "platform_admin",
  "compliance_officer",
  "support_agent",
  "billing_admin",
] as const satisfies readonly UserRole[];

export const ALL_INVITABLE_ROLES = [
  ...ORG_INVITABLE_ROLES,
  ...PLATFORM_INVITABLE_ROLES,
] as const satisfies readonly UserRole[];

export type OrgInvitableRole = (typeof ORG_INVITABLE_ROLES)[number];
export type PlatformInvitableRole = (typeof PLATFORM_INVITABLE_ROLES)[number];
export type InvitableRole = (typeof ALL_INVITABLE_ROLES)[number];

export function isOrgInvitableRole(role: string): role is OrgInvitableRole {
  return (ORG_INVITABLE_ROLES as readonly string[]).includes(role);
}

export function isPlatformInvitableRole(
  role: string,
): role is PlatformInvitableRole {
  return (PLATFORM_INVITABLE_ROLES as readonly string[]).includes(role);
}

export function isInvitableRole(role: string): role is InvitableRole {
  return (ALL_INVITABLE_ROLES as readonly string[]).includes(role);
}
