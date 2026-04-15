import {
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  FileUp,
  FolderOpen,
  HandCoins,
  Home,
  House,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Receipt,
  Repeat,
  Shield,
  ShieldCheck,
  Store,
  UserCircle,
  UserCog,
  Users,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavSubItem {
  title: string;
  url: string;
  circleColor: string;
  icon?: LucideIcon;
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
      { title: "Dashboard", url: "/dashboard", circleColor: "bg-green-500", icon: LayoutDashboard },
      { title: "Grants", url: "/grants", circleColor: "bg-blue-500", icon: HandCoins },
      { title: "Expenses", url: "/expenses", circleColor: "bg-cyan-500", icon: Receipt },
      { title: "Virtual Cards", url: "/virtual-cards", circleColor: "bg-purple-600", icon: CreditCard },
      { title: "Subscriptions", url: "/subscriptions", circleColor: "bg-cyan-500", icon: Repeat },
    ],
  },
  // ── Beneficiaries (the people you serve) ─────
  {
    title: "Beneficiaries",
    url: "#",
    icon: Users,
    items: [
      { title: "All Beneficiaries", url: "/beneficiaries", circleColor: "bg-yellow-500", icon: Users },
      { title: "Notifications", url: "/notifications", circleColor: "bg-red-500", icon: Bell },
      { title: "Messages", url: "/messages", circleColor: "bg-blue-500", icon: MessageSquare },
      { title: "Calendar", url: "/calendar", circleColor: "bg-green-500", icon: CalendarDays },
    ],
  },
  // ── Finance & Compliance ─────────────────────
  {
    title: "Finance",
    url: "#",
    icon: BarChart3,
    isActive: true,
    items: [
      { title: "Reports", url: "/reports", circleColor: "bg-violet-600", icon: BarChart3 },
      { title: "Audit Trail", url: "/audit-trail", circleColor: "bg-red-500", icon: ShieldCheck },
      { title: "Ledger", url: "/ledger", circleColor: "bg-red-500", icon: BookOpen },
      { title: "Policies", url: "/policies", circleColor: "bg-red-500", icon: FileText },
      { title: "Documents", url: "/documents", circleColor: "bg-yellow-500", icon: FolderOpen },
    ],
  },
  // ── Beneficiary Preview (admin sees what beneficiary sees) ──
  {
    title: "Beneficiary View",
    url: "#",
    icon: UserCircle,
    items: [
      { title: "My Dashboard", url: "/my-dashboard", circleColor: "bg-primary", icon: Home },
      { title: "My Documents", url: "/my-documents", circleColor: "bg-yellow-500", icon: FileUp },
    ],
  },
  // ── Organization (internal staff & vendors) ──
  { label: "Organization" },
  {
    title: "Team & Vendors",
    url: "#",
    icon: UsersRound,
    items: [
      { title: "Team", url: "/team", circleColor: "bg-blue-600", icon: UserCog },
      { title: "Vendors", url: "/vendors", circleColor: "bg-primary", icon: Store },
    ],
  },
  // ── Admin ────────────────────────────────────
  { label: "Admin" },
  {
    title: "Admin",
    url: "#",
    icon: ShieldCheck,
    items: [
      { title: "Organization", url: "/org-settings", circleColor: "bg-primary", icon: Building2 },
      { title: "Billing & Plans", url: "/settings/billing", circleColor: "bg-emerald-500", icon: CreditCard },
      { title: "Alert Preferences", url: "/alert-preferences", circleColor: "bg-yellow-500", icon: BellRing },
      { title: "Profile", url: "/profile", circleColor: "bg-red-600", icon: UserCircle },
    ],
  },
  // ── Support ──────────────────────────────────
  {
    title: "Support",
    url: "/support",
    icon: LifeBuoy,
  },
];

const beneficiaryNav: NavItem[] = [
  {
    title: "My Portal",
    url: "#",
    icon: House,
    isActive: true,
    items: [
      { title: "My Dashboard", url: "/my-dashboard", circleColor: "bg-primary", icon: Home },
      { title: "My Grants", url: "/grants", circleColor: "bg-blue-500", icon: HandCoins },
      { title: "My Expenses", url: "/expenses", circleColor: "bg-cyan-500", icon: Receipt },
      { title: "My Subscriptions", url: "/subscriptions", circleColor: "bg-cyan-500", icon: Repeat },
      { title: "My Cards", url: "/virtual-cards", circleColor: "bg-purple-600", icon: CreditCard },
      { title: "My Documents", url: "/my-documents", circleColor: "bg-yellow-500", icon: FileUp },
    ],
  },
  { label: "Communication" },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  { label: "Account" },
  {
    title: "My Profile",
    url: "/profile",
    icon: UserCircle,
  },
];

const vendorNav: NavItem[] = [
  {
    title: "Vendor Portal",
    url: "#",
    icon: House,
    isActive: true,
    items: [
      { title: "Dashboard", url: "/vendor-dashboard", circleColor: "bg-green-600", icon: LayoutDashboard },
      { title: "Invoices & Payments", url: "/invoices", circleColor: "bg-yellow-500", icon: Receipt },
    ],
  },
  { label: "Communication" },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  { label: "Account" },
  {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
  },
];

const cpaNav: NavItem[] = [
  {
    title: "Review",
    url: "#",
    icon: BarChart3,
    isActive: true,
    items: [
      { title: "Reports", url: "/reports", circleColor: "bg-violet-600", icon: BarChart3 },
      { title: "Audit Trail", url: "/audit-trail", circleColor: "bg-red-500", icon: ShieldCheck },
      { title: "Ledger", url: "/ledger", circleColor: "bg-red-500", icon: BookOpen },
      { title: "Documents", url: "/documents", circleColor: "bg-yellow-500", icon: FolderOpen },
    ],
  },
  { label: "Communication" },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  { label: "Account" },
  {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
  },
];

const complianceNav: NavItem[] = [
  {
    title: "Compliance",
    url: "#",
    icon: Shield,
    isActive: true,
    items: [
      { title: "Reports", url: "/reports", circleColor: "bg-violet-600", icon: BarChart3 },
      { title: "Audit Trail", url: "/audit-trail", circleColor: "bg-red-500", icon: ShieldCheck },
      { title: "Compliance", url: "/compliance", circleColor: "bg-yellow-500", icon: Shield },
      { title: "Ledger", url: "/ledger", circleColor: "bg-red-500", icon: BookOpen },
      { title: "Documents", url: "/documents", circleColor: "bg-yellow-500", icon: FolderOpen },
    ],
  },
  { label: "Communication" },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  { label: "Account" },
  {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
  },
];

const grantOfficerNav: NavItem[] = [
  {
    title: "Grant Oversight",
    url: "#",
    icon: FileText,
    isActive: true,
    items: [
      { title: "Reports", url: "/reports", circleColor: "bg-violet-600", icon: BarChart3 },
      { title: "Grants", url: "/grants", circleColor: "bg-blue-500", icon: HandCoins },
      { title: "Audit Trail", url: "/audit-trail", circleColor: "bg-red-500", icon: ShieldCheck },
    ],
  },
  { label: "Communication" },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  { label: "Account" },
  {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
  },
];

const supportNav: NavItem[] = [
  {
    title: "Support",
    url: "/support",
    icon: LifeBuoy,
  },
  { label: "Communication" },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  { label: "Account" },
  {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
  },
];

const billingAdminNav: NavItem[] = [
  {
    title: "Billing",
    url: "#",
    icon: CreditCard,
    isActive: true,
    items: [
      { title: "Billing & Plans", url: "/settings/billing", circleColor: "bg-blue-600", icon: CreditCard },
    ],
  },
  { label: "Organization" },
  {
    title: "Organization",
    url: "/org-settings",
    icon: Building2,
  },
  { label: "Communication" },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
  },
  {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
  },
];

// TODO: Platform admin portal is architecturally broken — all nonprofit
// pages filter by session.user.organizationId but platform_admin has no org.
// Needs either an org-selection UI or a separate /admin cross-org namespace.
// Tracked as a separate PDR. Do not add more pages to this nav until fixed.
const platformAdminNav: NavItem[] = [
  {
    title: "Platform",
    url: "#",
    icon: LayoutDashboard,
    isActive: true,
    items: [
      { title: "Platform Overview", url: "/platform", circleColor: "bg-red-600", icon: LayoutDashboard },
      { title: "Internal Staff", url: "/platform/internal-staff", circleColor: "bg-purple-600", icon: UserCog },
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

    case "billing_admin":
      return billingAdminNav;

    default:
      return nonprofitAdminNav;
  }
}

// Legacy export for backwards compatibility (shows all items when no role)
export const data = {
  navMain: nonprofitAdminNav,
};
