import type { UserRole } from "@/lib/generated/prisma/client";

// Route access control: which roles can access which route prefixes
const routePermissions: Record<string, UserRole[]> = {
  // Nonprofit admin + staff routes
  "/dashboard": ["nonprofit_admin", "nonprofit_staff", "platform_admin"],
  "/grants": ["nonprofit_admin", "nonprofit_staff", "auditor", "attorney", "grant_officer", "platform_admin"],
  "/beneficiaries": ["nonprofit_admin", "nonprofit_staff", "grant_officer", "platform_admin"],
  "/expenses": ["nonprofit_admin", "nonprofit_staff", "auditor", "attorney", "grant_officer", "compliance_officer", "platform_admin"],
  "/vendors": ["nonprofit_admin", "platform_admin"],
  "/cards": ["nonprofit_admin", "platform_admin"],
  "/subscriptions": ["nonprofit_admin", "platform_admin"],
  "/reports": ["nonprofit_admin", "cpa", "auditor", "grant_officer", "compliance_officer", "platform_admin"],
  "/users": ["nonprofit_admin", "platform_admin"],
  "/policies": ["nonprofit_admin", "platform_admin"],
  "/settings": ["nonprofit_admin", "platform_admin"],

  // Beneficiary routes
  "/my-dashboard": ["beneficiary"],
  "/my-expenses": ["beneficiary"],
  "/my-subscriptions": ["beneficiary"],

  // Shared document/export routes
  "/documents": ["beneficiary", "auditor", "attorney", "grant_officer", "platform_admin"],
  "/export": ["cpa", "auditor", "platform_admin"],

  // CPA + Auditor + Attorney routes
  "/audit-trail": ["cpa", "auditor", "attorney", "support_agent", "compliance_officer", "platform_admin"],
  "/compliance": ["cpa", "auditor", "attorney", "compliance_officer", "platform_admin"],

  // Vendor routes
  "/onboarding": ["vendor"],
  "/invoices": ["vendor"],
  "/payment-status": ["vendor"],

  // Platform admin routes
  "/customers": ["platform_admin", "support_agent", "billing_admin"],
  "/metrics": ["platform_admin", "billing_admin"],
  "/billing": ["platform_admin", "billing_admin"],
  "/compliance-rules": ["platform_admin", "compliance_officer"],
  "/support": ["platform_admin", "support_agent"],
  "/user-lookup": ["platform_admin", "support_agent"],
};

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  for (const [route, allowedRoles] of Object.entries(routePermissions)) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return allowedRoles.includes(role);
    }
  }
  return true;
}

export function getDefaultRoute(role: UserRole): string {
  const defaults: Record<UserRole, string> = {
    nonprofit_admin: "/dashboard",
    nonprofit_staff: "/dashboard",
    beneficiary: "/my-dashboard",
    cpa: "/reports",
    auditor: "/audit-trail",
    vendor: "/onboarding",
    attorney: "/compliance",
    grant_officer: "/grants",
    platform_admin: "/customers",
    support_agent: "/support",
    compliance_officer: "/compliance-rules",
    billing_admin: "/billing",
  };
  return defaults[role] || "/dashboard";
}

// Action-level permissions

export function canManageGrants(role: UserRole): boolean {
  return role === "nonprofit_admin" || role === "platform_admin";
}

export function canViewGrants(role: UserRole): boolean {
  return ["nonprofit_admin", "nonprofit_staff", "auditor", "attorney", "grant_officer", "platform_admin"].includes(role);
}

export function canApproveExpenses(role: UserRole): boolean {
  return role === "nonprofit_admin" || role === "platform_admin";
}

export function canSubmitExpenses(role: UserRole): boolean {
  return role === "beneficiary" || role === "nonprofit_staff";
}

export function canViewReports(role: UserRole): boolean {
  return ["nonprofit_admin", "cpa", "auditor", "grant_officer", "compliance_officer", "platform_admin"].includes(role);
}

export function canManageVendors(role: UserRole): boolean {
  return role === "nonprofit_admin" || role === "platform_admin";
}

export function canManageCards(role: UserRole): boolean {
  return role === "nonprofit_admin" || role === "platform_admin";
}

export function canManageTeam(role: UserRole): boolean {
  return role === "nonprofit_admin" || role === "platform_admin";
}

export function canViewAuditTrail(role: UserRole): boolean {
  return ["cpa", "auditor", "attorney", "support_agent", "compliance_officer", "platform_admin"].includes(role);
}

export function canManageCompliance(role: UserRole): boolean {
  return role === "compliance_officer" || role === "platform_admin";
}

export function canManageBilling(role: UserRole): boolean {
  return role === "billing_admin" || role === "platform_admin";
}
