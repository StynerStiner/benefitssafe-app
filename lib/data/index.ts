// Data Access Layer — single entry point for all dashboard data.
// Uses prismaRead (read replica) for all queries.
// Writes (cache invalidation) still use the primary via lib/cache.

import { prismaRead as prisma } from "@/lib/db-read";
import { cached, invalidateCacheByPrefix, CACHE_TTL } from "@/lib/cache";

// ============================================
// TYPES
// ============================================

export interface DashboardGrants {
  total: number;
  active: number;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  items: Array<{
    id: string;
    name: string;
    status: string;
    totalAmount: string;
    spentAmount: string;
    remainingAmount: string;
    createdAt: string;
    categories: Array<{ id: string; name: string; allocatedAmount: string; spentAmount: string }>;
    beneficiary: { id: string; firstName: string; lastName: string; email: string } | null;
  }>;
}

export interface DashboardExpenses {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  recentItems: Array<{
    id: string;
    description: string;
    amount: string;
    status: string;
    expenseType: string;
    frequency: string;
    riskClassification: string | null;
    riskNotes: string | null;
    createdAt: string;
    vendorName: string | null;
    requestedBy: { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null } | null;
    grant: { id: string; name: string; benefitFlags: unknown; organizationId: string } | null;
    category: { id: string; name: string } | null;
    vendor: { id: string; name: string; type: string } | null;
  }>;
}

export interface DashboardCards {
  total: number;
  active: number;
  frozen: number;
  items: Array<{
    id: string;
    last4: string;
    spendingCap: string | null;
    status: string;
    cardType: string;
    createdAt: string;
    beneficiary: { id: string; firstName: string; lastName: string } | null;
    vendor: { id: string; name: string } | null;
  }>;
}

export interface DashboardAuditLog {
  recentItems: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    userId: string;
    newValue: Record<string, unknown> | null;
  }>;
}

export interface DashboardSubscriptions {
  total: number;
  active: number;
  monthlyBurn: number;
  items: Array<{
    id: string;
    serviceName: string;
    monthlyCost: string;
    status: string;
    billingCycle: string;
    vendor: { id: string; name: string } | null;
  }>;
}

export interface DashboardCompliance {
  likelySafe: number;
  needsReview: number;
  likelyRisky: number;
  blocked: number;
}

export interface DashboardNotifications {
  unread: number;
  items: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    href: string | null;
  }>;
}

export interface DashboardData {
  grants: DashboardGrants;
  expenses: DashboardExpenses;
  cards: DashboardCards;
  auditLog: DashboardAuditLog;
  subscriptions: DashboardSubscriptions;
  compliance: DashboardCompliance;
  notifications: DashboardNotifications;
}

// ============================================
// ROLE → DATA MAPPING
// ============================================

type DataSection = keyof DashboardData;

const ROLE_DATA_MAP: Record<string, DataSection[]> = {
  nonprofit_admin: ["grants", "expenses", "cards", "auditLog", "subscriptions", "compliance", "notifications"],
  platform_admin: ["grants", "expenses", "cards", "auditLog", "subscriptions", "compliance", "notifications"],
  nonprofit_staff: ["grants", "expenses", "notifications", "auditLog"],
  beneficiary: ["grants", "expenses", "cards", "subscriptions", "notifications"],
  vendor: ["notifications"],
  cpa: ["grants", "expenses", "auditLog", "compliance"],
  auditor: ["grants", "expenses", "auditLog", "compliance"],
  attorney: ["grants", "auditLog", "compliance"],
  grant_officer: ["grants", "expenses", "auditLog"],
  compliance_officer: ["grants", "expenses", "auditLog", "compliance"],
  support_agent: ["grants", "expenses", "cards", "auditLog", "notifications"],
  billing_admin: ["notifications"],
};

// ============================================
// DATA FETCHERS (per section)
// ============================================

async function fetchGrants(
  organizationId: string,
  userId: string,
  role: string,
  limit: number,
): Promise<DashboardGrants> {
  // Post org-switcher: platform_admin always has a valid organizationId
  // (the tenant selected via /api/platform/switch-org). The legacy
  // cross-org branch leaked data and was a SOC 2 incident. Every role
  // scopes to the currently-active org. (DDIA Ch5 Replication audit.)
  const where = role === "beneficiary"
    ? { organizationId, beneficiaryId: userId, archivedAt: null }
    : { organizationId, archivedAt: null };

  const items = await prisma.grant.findMany({
    where,
    include: {
      categories: { select: { id: true, name: true, allocatedAmount: true, spentAmount: true } },
      beneficiary: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const active = items.filter((g) => g.status === "ACTIVE").length;
  const totalBudget = items.reduce((s, g) => s + Number(g.totalAmount), 0);
  const totalSpent = items.reduce((s, g) => s + Number(g.spentAmount), 0);

  return {
    total: items.length,
    active,
    totalBudget,
    totalSpent,
    remaining: totalBudget - totalSpent,
    items: items.map((g) => ({
      id: g.id,
      name: g.name,
      status: g.status,
      totalAmount: g.totalAmount.toString(),
      spentAmount: g.spentAmount.toString(),
      remainingAmount: g.remainingAmount.toString(),
      createdAt: g.createdAt.toISOString(),
      categories: g.categories.map((c) => ({
        id: c.id,
        name: c.name,
        allocatedAmount: c.allocatedAmount.toString(),
        spentAmount: c.spentAmount.toString(),
      })),
      beneficiary: g.beneficiary ? {
        id: g.beneficiary.id,
        firstName: g.beneficiary.firstName,
        lastName: g.beneficiary.lastName,
        email: g.beneficiary.email,
      } : null,
    })),
  };
}

async function fetchExpenses(
  organizationId: string,
  userId: string,
  role: string,
  limit: number,
): Promise<DashboardExpenses> {
  // Filter by the denormalized ExpenseRequest.organizationId column so the
  // covering index @@index([organizationId, status, createdAt]) is used.
  // The old shape `grant: { is: { organizationId } }` pushed this into a
  // Grant subquery and bypassed the index entirely. (DDIA Ch3 audit.)
  //
  // Post org-switcher: platform_admin gets the same org scoping as every
  // other role — the `platform_admin ? {} : { organizationId }` legacy
  // ternary leaked cross-tenant data. (DDIA Ch5 Replication audit.)
  const where = role === "beneficiary"
    ? { requestedById: userId, organizationId }
    : { organizationId };

  const items = await prisma.expenseRequest.findMany({
    where,
    include: {
      grant: { select: { id: true, name: true, benefitFlags: true, organizationId: true } },
      category: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      vendor: { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    total: items.length,
    pending: items.filter((e) => e.status === "PENDING").length,
    approved: items.filter((e) => e.status === "APPROVED").length,
    rejected: items.filter((e) => e.status === "REJECTED").length,
    recentItems: items.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount.toString(),
      status: e.status,
      expenseType: e.expenseType,
      frequency: e.frequency,
      riskClassification: e.riskClassification,
      riskNotes: e.riskNotes,
      createdAt: e.createdAt.toISOString(),
      vendorName: e.vendorName,
      requestedBy: e.requestedBy ? {
        id: e.requestedBy.id,
        firstName: e.requestedBy.firstName,
        lastName: e.requestedBy.lastName,
        email: e.requestedBy.email,
        avatarUrl: e.requestedBy.avatarUrl,
      } : null,
      grant: e.grant ? {
        id: e.grant.id,
        name: e.grant.name,
        benefitFlags: e.grant.benefitFlags,
        organizationId: e.grant.organizationId,
      } : null,
      category: e.category ? { id: e.category.id, name: e.category.name } : null,
      vendor: e.vendor ? { id: e.vendor.id, name: e.vendor.name, type: e.vendor.type } : null,
    })),
  };
}

async function fetchCards(
  organizationId: string,
  userId: string,
  role: string,
  limit: number,
): Promise<DashboardCards> {
  const where = role === "beneficiary"
    ? { organizationId, beneficiaryId: userId }
    : { organizationId };

  const items = await prisma.virtualCard.findMany({
    where,
    select: {
      id: true,
      last4: true,
      spendingCap: true,
      status: true,
      cardType: true,
      createdAt: true,
      beneficiary: { select: { id: true, firstName: true, lastName: true } },
      vendor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
    total: items.length,
    active: items.filter((c) => c.status === "ACTIVE").length,
    frozen: items.filter((c) => c.status === "FROZEN").length,
    items: items.map((c) => ({
      id: c.id,
      last4: c.last4,
      spendingCap: c.spendingCap?.toString() ?? null,
      status: c.status,
      cardType: c.cardType,
      createdAt: c.createdAt.toISOString(),
      beneficiary: c.beneficiary ? {
        id: c.beneficiary.id,
        firstName: c.beneficiary.firstName,
        lastName: c.beneficiary.lastName,
      } : null,
      vendor: c.vendor ? { id: c.vendor.id, name: c.vendor.name } : null,
    })),
  };
}

async function fetchAuditLog(
  organizationId: string,
  _role: string,
): Promise<DashboardAuditLog> {
  // Every role — including platform_admin — is scoped to the currently
  // active organizationId. Post org-switcher, the legacy
  // `platform_admin ? {} : { organizationId }` branch was a cross-tenant
  // audit-log leak: a platform admin who switched into Tenant A still saw
  // every other tenant's audit logs through this dashboard fetcher. If a
  // platform admin needs to review a different tenant, they switch orgs
  // via the banner. (DDIA Ch5 Replication audit.)
  const where = { organizationId };

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    recentItems: items.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      createdAt: a.createdAt.toISOString(),
      userId: a.userId,
      newValue: a.newValue as Record<string, unknown> | null,
    })),
  };
}

async function fetchSubscriptions(
  organizationId: string,
  userId: string,
  role: string,
  limit: number,
): Promise<DashboardSubscriptions> {
  // Filter by the denormalized Subscription.organizationId so the existing
  // @@index([organizationId]) is used. The old shape
  // `vendor: { organizationId }` forced a subquery on Vendor and bypassed
  // the direct Subscription index. (DDIA Ch3 audit.)
  const where = { organizationId };

  const items = await prisma.subscription.findMany({
    where,
    include: {
      vendor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const activeItems = items.filter((s) => s.status === "ACTIVE");

  return {
    total: items.length,
    active: activeItems.length,
    monthlyBurn: activeItems.reduce((s, sub) => s + Number(sub.monthlyCost), 0),
    items: items.map((s) => ({
      id: s.id,
      serviceName: s.serviceName,
      monthlyCost: s.monthlyCost.toString(),
      status: s.status,
      billingCycle: s.billingCycle,
      vendor: s.vendor ? { id: s.vendor.id, name: s.vendor.name } : null,
    })),
  };
}

async function fetchCompliance(
  organizationId: string,
  _role: string,
): Promise<DashboardCompliance> {
  // Uses the denormalized ExpenseRequest.organizationId + the new
  // @@index([organizationId, riskClassification]) composite so each
  // bucket count is an indexed range read instead of a full scan.
  // groupBy is one round-trip instead of four, and with this index it's
  // a HashAggregate over an index range rather than a seq scan.
  //
  // Post org-switcher: every role (including platform_admin) scopes to
  // the currently-active organizationId. (DDIA Ch5 Replication audit.)
  const where = { organizationId };

  const groups = await prisma.expenseRequest.groupBy({
    by: ["riskClassification"],
    where,
    _count: { _all: true },
  });

  const counts = {
    likelySafe: 0,
    needsReview: 0,
    likelyRisky: 0,
    blocked: 0,
  };

  for (const g of groups) {
    switch (g.riskClassification) {
      case "LIKELY_SAFE":
        counts.likelySafe = g._count._all;
        break;
      case "NEEDS_REVIEW":
        counts.needsReview = g._count._all;
        break;
      case "LIKELY_RISKY":
        counts.likelyRisky = g._count._all;
        break;
      case "BLOCKED":
        counts.blocked = g._count._all;
        break;
    }
  }

  return counts;
}

async function fetchNotifications(
  userId: string,
  organizationId: string,
): Promise<DashboardNotifications> {
  const items = await prisma.notification.findMany({
    where: { userId, organizationId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    unread: items.filter((n) => !n.read).length,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      href: n.href,
    })),
  };
}

// ============================================
// MAIN ENTRY POINT
// ============================================

export async function getDashboardData(
  role: string,
  userId: string,
  organizationId: string,
  options?: { limit?: number },
): Promise<Partial<DashboardData>> {
  const limit = options?.limit ?? 100;
  const sections = ROLE_DATA_MAP[role] ?? ROLE_DATA_MAP.nonprofit_admin;
  const cacheKey = `dashboard:${organizationId}:${role}:${userId}`;

  return cached<Partial<DashboardData>>(cacheKey, CACHE_TTL.SHORT, async () => {
    const fetchers: Array<Promise<[DataSection, unknown]>> = [];

    if (sections.includes("grants")) {
      fetchers.push(fetchGrants(organizationId, userId, role, limit).then((d) => ["grants", d]));
    }
    if (sections.includes("expenses")) {
      fetchers.push(fetchExpenses(organizationId, userId, role, limit).then((d) => ["expenses", d]));
    }
    if (sections.includes("cards")) {
      fetchers.push(fetchCards(organizationId, userId, role, limit).then((d) => ["cards", d]));
    }
    if (sections.includes("auditLog")) {
      fetchers.push(fetchAuditLog(organizationId, role).then((d) => ["auditLog", d]));
    }
    if (sections.includes("subscriptions")) {
      fetchers.push(fetchSubscriptions(organizationId, userId, role, limit).then((d) => ["subscriptions", d]));
    }
    if (sections.includes("compliance")) {
      fetchers.push(fetchCompliance(organizationId, role).then((d) => ["compliance", d]));
    }
    if (sections.includes("notifications")) {
      fetchers.push(fetchNotifications(userId, organizationId).then((d) => ["notifications", d]));
    }

    const results = await Promise.all(fetchers);
    const data: Partial<DashboardData> = {};
    for (const [key, value] of results) {
      (data as Record<string, unknown>)[key] = value;
    }
    return data;
  });
}

// ============================================
// CACHE INVALIDATION (call on writes)
// ============================================

export async function invalidateDashboardCache(organizationId: string): Promise<void> {
  await invalidateCacheByPrefix(`dashboard:${organizationId}:`);
}
