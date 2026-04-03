import {
  BarChart3,
  FileText,
  HeadphonesIcon,
  House,
  LayoutDashboard,
  MessageCircleMore,
  Settings,
  Shield,
  ShieldCheck,
  UserCircle,
  Users,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavSubItem {
  title: string;
  url: string;
  circleColor: string;
}

interface NavItem {
  title?: string;
  url?: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: NavSubItem[];
  label?: string;
}

// ============================================
// ROLE-BASED SIDEBAR DEFINITIONS
// ============================================

const nonprofitAdminNav: NavItem[] = [
  // ── Core Operations ──────────────────────────
  {
    title: "Main",
    url: "#",
    icon: House,
    isActive: true,
    items: [
      { title: "Dashboard", url: "/dashboard", circleColor: "bg-green-500" },
      { title: "Grants", url: "/grants", circleColor: "bg-blue-500" },
      { title: "Expenses", url: "/expenses", circleColor: "bg-cyan-500" },
      { title: "Virtual Cards", url: "/virtual-cards", circleColor: "bg-purple-600" },
      { title: "Subscriptions", url: "/subscriptions", circleColor: "bg-cyan-500" },
    ],
  },
  // ── Beneficiaries (the people you serve) ─────
  {
    title: "Beneficiaries",
    url: "#",
    icon: Users,
    items: [
      { title: "All Beneficiaries", url: "/beneficiaries", circleColor: "bg-yellow-500" },
      { title: "Notifications", url: "/notifications", circleColor: "bg-red-500" },
      { title: "Messages", url: "/messages", circleColor: "bg-blue-500" },
      { title: "Calendar", url: "/calendar", circleColor: "bg-green-500" },
    ],
  },
  // ── Finance & Compliance ─────────────────────
  {
    title: "Finance",
    url: "#",
    icon: BarChart3,
    isActive: true,
    items: [
      { title: "Reports", url: "/reports", circleColor: "bg-violet-600" },
      { title: "Audit Trail", url: "/audit-trail", circleColor: "bg-red-500" },
      { title: "Ledger", url: "/ledger", circleColor: "bg-red-500" },
      { title: "Policies", url: "/policies", circleColor: "bg-red-500" },
      { title: "Documents", url: "/documents", circleColor: "bg-yellow-500" },
    ],
  },
  // ── Beneficiary Preview (admin sees what beneficiary sees) ──
  {
    title: "Beneficiary View",
    url: "#",
    icon: UserCircle,
    items: [
      { title: "My Dashboard", url: "/my-dashboard", circleColor: "bg-primary" },
      { title: "My Documents", url: "/my-documents", circleColor: "bg-yellow-500" },
    ],
  },
  // ── Organization (internal staff & vendors) ──
  { label: "Organization" },
  {
    title: "Team & Vendors",
    url: "#",
    icon: UsersRound,
    items: [
      { title: "Team", url: "/team", circleColor: "bg-blue-600" },
      { title: "Vendors", url: "/vendors", circleColor: "bg-primary" },
    ],
  },
  // ── Admin ────────────────────────────────────
  { label: "Admin" },
  {
    title: "Admin",
    url: "#",
    icon: ShieldCheck,
    items: [
      { title: "Organization", url: "/org-settings", circleColor: "bg-primary" },
      { title: "Alert Preferences", url: "/alert-preferences", circleColor: "bg-yellow-500" },
      { title: "Profile", url: "/profile", circleColor: "bg-red-600" },
    ],
  },
  // ── Settings & Support ──────────────────────
  {
    title: "Settings",
    url: "#",
    icon: Settings,
    items: [
      { title: "Theme", url: "#", circleColor: "bg-purple-500" },
    ],
  },
  {
    title: "Support",
    url: "/support",
    icon: HeadphonesIcon,
  },
];

const beneficiaryNav: NavItem[] = [
  {
    title: "My Portal",
    url: "#",
    icon: House,
    isActive: true,
    items: [
      { title: "My Dashboard", url: "/my-dashboard", circleColor: "bg-primary" },
      { title: "My Grants", url: "/grants", circleColor: "bg-blue-500" },
      { title: "My Expenses", url: "/expenses", circleColor: "bg-cyan-500" },
      { title: "My Subscriptions", url: "/subscriptions", circleColor: "bg-cyan-500" },
      { title: "My Cards", url: "/virtual-cards", circleColor: "bg-purple-600" },
      { title: "My Documents", url: "/my-documents", circleColor: "bg-yellow-500" },
    ],
  },
  { label: "Communication" },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageCircleMore,
  },
  { label: "Account" },
  {
    title: "My Profile",
    url: "/profile",
    icon: Users,
  },
];

const vendorNav: NavItem[] = [
  {
    title: "Vendor Portal",
    url: "#",
    icon: House,
    isActive: true,
    items: [
      { title: "Dashboard", url: "/vendor-dashboard", circleColor: "bg-green-600" },
      { title: "Invoices & Payments", url: "/invoices", circleColor: "bg-yellow-500" },
    ],
  },
  { label: "Account" },
  {
    title: "Profile",
    url: "/profile",
    icon: Users,
  },
];

const cpaNav: NavItem[] = [
  {
    title: "Review",
    url: "#",
    icon: BarChart3,
    isActive: true,
    items: [
      { title: "Reports", url: "/reports", circleColor: "bg-violet-600" },
      { title: "Audit Trail", url: "/audit-trail", circleColor: "bg-red-500" },
      { title: "Ledger", url: "/ledger", circleColor: "bg-red-500" },
      { title: "Documents", url: "/documents", circleColor: "bg-yellow-500" },
    ],
  },
];

const complianceNav: NavItem[] = [
  {
    title: "Compliance",
    url: "#",
    icon: Shield,
    isActive: true,
    items: [
      { title: "Reports", url: "/reports", circleColor: "bg-violet-600" },
      { title: "Audit Trail", url: "/audit-trail", circleColor: "bg-red-500" },
      { title: "Compliance", url: "/compliance", circleColor: "bg-yellow-500" },
      { title: "Ledger", url: "/ledger", circleColor: "bg-red-500" },
      { title: "Documents", url: "/documents", circleColor: "bg-yellow-500" },
    ],
  },
];

const grantOfficerNav: NavItem[] = [
  {
    title: "Grant Oversight",
    url: "#",
    icon: FileText,
    isActive: true,
    items: [
      { title: "Reports", url: "/reports", circleColor: "bg-violet-600" },
      { title: "Grants", url: "/grants", circleColor: "bg-blue-500" },
      { title: "Audit Trail", url: "/audit-trail", circleColor: "bg-red-500" },
    ],
  },
];

const supportNav: NavItem[] = [
  {
    title: "Support",
    url: "/support",
    icon: HeadphonesIcon,
  },
  {
    title: "All Users",
    url: "/vendors",
    icon: UsersRound,
  },
];

const platformAdminNav: NavItem[] = [
  {
    title: "Platform",
    url: "#",
    icon: LayoutDashboard,
    isActive: true,
    items: [
      { title: "Platform Overview", url: "/platform", circleColor: "bg-red-600" },
    ],
  },
  { label: "Org Management" },
  ...nonprofitAdminNav,
];

// ============================================
// ROLE → NAV MAPPING
// ============================================

export function getNavForRole(role: string): NavItem[] {
  switch (role) {
    case "nonprofit_admin":
    case "nonprofit_staff":
      return nonprofitAdminNav;

    case "beneficiary":
      return beneficiaryNav;

    case "vendor":
      return vendorNav;

    case "cpa":
    case "auditor":
    case "finance_officer":
      return cpaNav;

    case "attorney":
    case "compliance_officer":
      return complianceNav;

    case "grant_officer":
      return grantOfficerNav;

    case "platform_admin":
      return platformAdminNav;

    case "support_agent":
      return supportNav;

    default:
      return nonprofitAdminNav;
  }
}

// Legacy export for backwards compatibility (shows all items when no role)
export const data = {
  navMain: nonprofitAdminNav,
};
