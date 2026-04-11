// Role-aware profile field configuration.
// Drives which fields each of the 12 user roles can see, edit, or is hidden.
// The PATCH /api/users/profile handler enforces this server-side.

export type ProfileField =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "title"
  | "companyName"
  | "businessAddress"
  | "firmName"
  | "licenseNumber"
  | "barNumber"
  | "organizationName"
  | "emergencyContactName"
  | "emergencyContactPhone";

export interface ProfileExtraSection {
  label: string;
  href: string;
}

export interface ProfileRoleConfig {
  editableFields: ProfileField[];
  readOnlyFields: ProfileField[];
  extraSections: ProfileExtraSection[];
}

// Field labels — customize display text per field. These override any defaults.
export const fieldLabels: Record<ProfileField, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  title: "Title",
  companyName: "Company Name",
  businessAddress: "Business Address",
  firmName: "Firm Name",
  licenseNumber: "License Number",
  barNumber: "Bar Number",
  organizationName: "Organization / Foundation",
  emergencyContactName: "Emergency Contact Name",
  emergencyContactPhone: "Emergency Contact Phone",
};

// Role display metadata — the colored badge shown on every profile page.
export interface RoleDisplay {
  label: string;
  badgeClass: string;
}

export const roleDisplay: Record<string, RoleDisplay> = {
  nonprofit_admin: { label: "Nonprofit Admin", badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  nonprofit_staff: { label: "Nonprofit Staff", badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  platform_admin: { label: "Platform Admin", badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" },
  support_agent: { label: "Support Agent", badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200" },
  billing_admin: { label: "Billing Admin", badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" },
  compliance_officer: { label: "Compliance Officer", badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  beneficiary: { label: "Beneficiary", badgeClass: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200" },
  vendor: { label: "Vendor", badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200" },
  cpa: { label: "CPA", badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200" },
  auditor: { label: "Auditor", badgeClass: "bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200" },
  attorney: { label: "Attorney", badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  grant_officer: { label: "Grant Officer", badgeClass: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200" },
};

// Per-role field access. Image/avatar is always editable by every authenticated
// user (handled by /api/users/avatar, not by this PATCH endpoint).
export const profileConfig: Record<string, ProfileRoleConfig> = {
  // ── TIER 1: internal org users ──
  nonprofit_admin: {
    editableFields: ["firstName", "lastName", "email", "phone", "title"],
    readOnlyFields: [],
    extraSections: [{ label: "Manage Staff Profiles", href: "/team" }],
  },
  nonprofit_staff: {
    editableFields: ["firstName", "lastName", "email", "phone", "title"],
    readOnlyFields: [],
    extraSections: [],
  },
  platform_admin: {
    editableFields: ["firstName", "lastName", "email", "phone", "title"],
    readOnlyFields: [],
    extraSections: [{ label: "Manage All Users", href: "/customers" }],
  },
  support_agent: {
    editableFields: ["firstName", "lastName", "email", "phone", "title"],
    readOnlyFields: [],
    extraSections: [],
  },
  billing_admin: {
    editableFields: ["firstName", "lastName", "email", "phone", "title"],
    readOnlyFields: [],
    extraSections: [],
  },
  compliance_officer: {
    editableFields: ["firstName", "lastName", "email", "phone", "title"],
    readOnlyFields: [],
    extraSections: [],
  },

  // ── TIER 2: external users ──
  beneficiary: {
    editableFields: ["firstName", "lastName", "phone", "emergencyContactName", "emergencyContactPhone"],
    readOnlyFields: ["email"],
    extraSections: [],
  },
  vendor: {
    editableFields: ["firstName", "lastName", "phone", "email", "companyName", "businessAddress"],
    readOnlyFields: [],
    extraSections: [],
  },

  // ── TIER 3: advisory / read-only ──
  cpa: {
    editableFields: ["firstName", "lastName", "email", "phone", "firmName", "licenseNumber"],
    readOnlyFields: [],
    extraSections: [],
  },
  auditor: {
    // Auditors can only update their photo — all text fields are read-only.
    editableFields: [],
    readOnlyFields: ["firstName", "lastName", "email", "phone"],
    extraSections: [],
  },
  attorney: {
    editableFields: ["firstName", "lastName", "email", "phone", "firmName", "barNumber"],
    readOnlyFields: [],
    extraSections: [],
  },
  grant_officer: {
    editableFields: ["firstName", "lastName", "email", "phone", "organizationName"],
    readOnlyFields: [],
    extraSections: [],
  },
};

// Fallback used when a role string is not found in profileConfig.
// Minimal safe default: allow editing name/phone only.
export const defaultProfileConfig: ProfileRoleConfig = {
  editableFields: ["firstName", "lastName", "phone"],
  readOnlyFields: ["email"],
  extraSections: [],
};

export function getProfileConfig(role: string | undefined | null): ProfileRoleConfig {
  if (!role) return defaultProfileConfig;
  return profileConfig[role] ?? defaultProfileConfig;
}
