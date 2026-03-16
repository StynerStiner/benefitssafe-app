import {
  BarChart3,
  CalendarDays,
  FileText,
  HeadphonesIcon,
  House,
  LayoutDashboard,
  Mail,
  MessageCircleMore,
  Settings,
  Shield,
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
  {
    title: "Main",
    url: "#",
    icon: House,
    isActive: true,
    items: [
      { title: "Dashboard", url: "/dashboard", circleColor: "bg-green-500" },
      { title: "Grants", url: "/grants", circleColor: "bg-blue-500" },
      { title: "Expenses", url: "/expenses", circleColor: "bg-cyan-500" },
      { title: "Beneficiaries", url: "/beneficiaries", circleColor: "bg-yellow-500" },
      { title: "Vendors", url: "/vendors", circleColor: "bg-primary" },
      { title: "Virtual Cards", url: "/virtual-cards", circleColor: "bg-purple-600" },
      { title: "Subscriptions", url: "/subscriptions", circleColor: "bg-cyan-500" },
    ],
  },
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
  { label: "People" },
  {
    title: "Team",
    url: "/team",
    icon: UsersRound,
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageCircleMore,
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: Mail,
  },
  {
    title: "Calendar",
    url: "/calendar",
    icon: CalendarDays,
  },
  { label: "Settings" },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
    isActive: true,
    items: [
      { title: "Theme", url: "#", circleColor: "bg-primary" },
      { title: "Organization", url: "/org-settings", circleColor: "bg-primary" },
      { title: "Alert Preferences", url: "/alert-preferences", circleColor: "bg-yellow-500" },
      { title: "Profile", url: "/profile", circleColor: "bg-red-600" },
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
      { title: "All Users", url: "/vendors", circleColor: "bg-primary" },
      { title: "All Organizations", url: "/beneficiaries", circleColor: "bg-yellow-500" },
      { title: "Support Tickets", url: "/support", circleColor: "bg-blue-500" },
      { title: "Platform Metrics", url: "/reports", circleColor: "bg-violet-600" },
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
