// Data Access Layer — single entry point for all dashboard data.
// Today: queries Prisma directly with Promise.all parallelism.
// Tomorrow: add Redis cache, read replicas — zero component changes.

import { prisma } from "@/lib/db";
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
  const where = role === "beneficiary"
    ? { organizationId, beneficiaryId: userId, archivedAt: null }
    : role === "platform_admin"
      ? { archivedAt: null }
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
  const where = role === "beneficiary"
    ? { requestedById: userId, grant: { is: { organizationId } } }
    : role === "platform_admin"
      ? {}
      : { grant: { is: { organizationId } } };

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
  role: string,
): Promise<DashboardAuditLog> {
  const where = (role === "platform_admin" || role === "compliance_officer")
    ? {}
    : { organizationId };

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
  const where = { vendor: { organizationId } };

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
  role: string,
): Promise<DashboardCompliance> {
  const where = role === "platform_admin"
    ? {}
    : { grant: { is: { organizationId } } };

  const expenses = await prisma.expenseRequest.findMany({
    where,
    select: { riskClassification: true },
  });

  return {
    likelySafe: expenses.filter((e) => e.riskClassification === "LIKELY_SAFE").length,
    needsReview: expenses.filter((e) => e.riskClassification === "NEEDS_REVIEW").length,
    likelyRisky: expenses.filter((e) => e.riskClassification === "LIKELY_RISKY").length,
    blocked: expenses.filter((e) => e.riskClassification === "BLOCKED").length,
  };
}

async function fetchNotifications(
  userId: string,
): Promise<DashboardNotifications> {
  const items = await prisma.notification.findMany({
    where: { userId },
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
      fetchers.push(fetchNotifications(userId).then((d) => ["notifications", d]));
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
