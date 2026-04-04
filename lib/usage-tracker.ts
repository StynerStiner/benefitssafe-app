// Usage tracking for BenefitsSafe billing quotas.
// Writes to UsageCounter (per-org, per-month) and combines with tier limits
// for the billing page dashboard.
//
// Fail-open: errors are logged but never block the user action.

import { prisma } from "@/lib/db";
import { getOrgTier, getCurrentPeriod } from "@/lib/feature-gates";
import { getLimit, UNLIMITED, type TierLimitKey } from "@/lib/pricing";

// ----------------------------------------------------------------------------
// Metric keys (numeric counters on UsageCounter)
// ----------------------------------------------------------------------------

export type UsageMetric =
  | "beneficiariesAdded"
  | "grantsCreated"
  | "expensesProcessed"
  | "cardsIssued"
  | "apiCalls";

export type UsageFloatMetric = "storageMB";

export type AnyUsageMetric = UsageMetric | UsageFloatMetric;

// ----------------------------------------------------------------------------
// Increment (upsert UsageCounter for current period)
// ----------------------------------------------------------------------------

/**
 * Atomically increment a usage counter for the current billing period (YYYY-MM).
 * Creates the counter row on first use for the month.
 *
 * Integer metrics: beneficiariesAdded, grantsCreated, expensesProcessed, cardsIssued, apiCalls
 * Float metric:    storageMB
 *
 * Fail-open: logs errors but returns quietly so a counter glitch cannot block
 * a successful user action.
 */
export async function incrementUsage(
  organizationId: string,
  metric: AnyUsageMetric,
  amount: number = 1,
): Promise<void> {
  try {
    const period = getCurrentPeriod();
    // Upsert: create the row with amount set, or increment the existing field.
    await prisma.usageCounter.upsert({
      where: { organizationId_period: { organizationId, period } },
      create: {
        organizationId,
        period,
        beneficiariesAdded: metric === "beneficiariesAdded" ? amount : 0,
        grantsCreated: metric === "grantsCreated" ? amount : 0,
        expensesProcessed: metric === "expensesProcessed" ? amount : 0,
        cardsIssued: metric === "cardsIssued" ? amount : 0,
        apiCalls: metric === "apiCalls" ? amount : 0,
        storageMB: metric === "storageMB" ? amount : 0,
      },
      update: {
        [metric]: { increment: amount },
      },
    });
  } catch (error) {
    console.error(
      `[usage-tracker] incrementUsage failed for org=${organizationId} metric=${metric}:`,
      error,
    );
    // Fail open — never block the caller
  }
}

// ----------------------------------------------------------------------------
// Read raw counter values for a period
// ----------------------------------------------------------------------------

export type UsageSnapshot = {
  organizationId: string;
  period: string;
  beneficiariesAdded: number;
  grantsCreated: number;
  expensesProcessed: number;
  cardsIssued: number;
  apiCalls: number;
  storageMB: number;
};

/**
 * Returns the raw UsageCounter row for the given period (defaults to current month).
 * Returns all-zero snapshot if no counter row exists yet.
 */
export async function getUsage(
  organizationId: string,
  period?: string,
): Promise<UsageSnapshot> {
  const targetPeriod = period || getCurrentPeriod();
  try {
    const row = await prisma.usageCounter.findUnique({
      where: { organizationId_period: { organizationId, period: targetPeriod } },
    });
    if (!row) {
      return emptySnapshot(organizationId, targetPeriod);
    }
    return {
      organizationId: row.organizationId,
      period: row.period,
      beneficiariesAdded: row.beneficiariesAdded,
      grantsCreated: row.grantsCreated,
      expensesProcessed: row.expensesProcessed,
      cardsIssued: row.cardsIssued,
      apiCalls: row.apiCalls,
      storageMB: row.storageMB,
    };
  } catch (error) {
    console.error("[usage-tracker] getUsage error, returning empty snapshot:", error);
    return emptySnapshot(organizationId, targetPeriod);
  }
}

function emptySnapshot(organizationId: string, period: string): UsageSnapshot {
  return {
    organizationId,
    period,
    beneficiariesAdded: 0,
    grantsCreated: 0,
    expensesProcessed: 0,
    cardsIssued: 0,
    apiCalls: 0,
    storageMB: 0,
  };
}

// ----------------------------------------------------------------------------
// Usage vs Limits (for billing page progress bars)
// ----------------------------------------------------------------------------

export type UsageLimitRow = {
  metric: TierLimitKey;
  label: string;
  current: number;
  limit: number;
  percentage: number; // 0..1
  atLimit: boolean;
  unlimited: boolean;
};

/**
 * Returns the full picture of usage vs tier limits for the billing dashboard.
 * Note: some limits are "total active" (beneficiaries, grants, team members)
 * while others are "monthly" (expenses, cards). This function queries the
 * correct source for each.
 */
export async function getUsageVsLimits(
  organizationId: string,
): Promise<UsageLimitRow[]> {
  try {
    const { tier } = await getOrgTier(organizationId);
    const period = getCurrentPeriod();

    // Pull everything in parallel
    const [beneficiaryCount, grantCount, teamCount, counter] = await Promise.all([
      prisma.user.count({
        where: { organizationId, role: "beneficiary", isActive: true },
      }),
      prisma.grant.count({
        where: { organizationId, archivedAt: null },
      }),
      prisma.user.count({
        where: {
          organizationId,
          isActive: true,
          role: { notIn: ["beneficiary", "vendor"] },
        },
      }),
      prisma.usageCounter.findUnique({
        where: { organizationId_period: { organizationId, period } },
        select: {
          expensesProcessed: true,
          cardsIssued: true,
          storageMB: true,
        },
      }),
    ]);

    const rows: UsageLimitRow[] = [
      buildRow(tier, "maxBeneficiaries", "Beneficiaries", beneficiaryCount),
      buildRow(tier, "maxGrants", "Grants", grantCount),
      buildRow(
        tier,
        "maxExpensesPerMonth",
        "Expenses this month",
        counter?.expensesProcessed ?? 0,
      ),
      buildRow(
        tier,
        "maxCardsPerMonth",
        "Cards issued this month",
        counter?.cardsIssued ?? 0,
      ),
      buildRow(tier, "maxTeamMembers", "Team members", teamCount),
      buildRow(
        tier,
        "maxStorageMB",
        "Storage (MB)",
        counter?.storageMB ?? 0,
      ),
    ];

    return rows;
  } catch (error) {
    console.error("[usage-tracker] getUsageVsLimits error:", error);
    return [];
  }
}

function buildRow(
  tier: Parameters<typeof getLimit>[0],
  metric: TierLimitKey,
  label: string,
  current: number,
): UsageLimitRow {
  const limit = getLimit(tier, metric);
  const unlimited = limit === UNLIMITED;
  const percentage =
    unlimited || limit <= 0 ? 0 : Math.min(1, current / limit);
  const atLimit = !unlimited && current >= limit;
  return {
    metric,
    label,
    current,
    limit,
    percentage,
    atLimit,
    unlimited,
  };
}
