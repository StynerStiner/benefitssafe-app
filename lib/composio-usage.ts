import { prisma } from "@/lib/db";

// Composio tier limits
const TIER_LIMITS = {
  free: 20_000,
  pro: 200_000,
  enterprise: 2_000_000,
} as const;

// Current tier -- change this when you upgrade on Composio dashboard
const CURRENT_TIER: keyof typeof TIER_LIMITS = "free";

interface UsageReport {
  currentMonth: string;
  callsThisMonth: number;
  tierLimit: number;
  tier: string;
  percentUsed: number;
  remainingCalls: number;
  shouldUpgrade: boolean;
  warningLevel: "ok" | "watch" | "urgent" | "exceeded";
}

/**
 * Get current month's Composio usage across all orgs.
 * Counts WorkflowLog entries (each = 1 Composio API call).
 */
export async function getComposioUsage(): Promise<UsageReport> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const callsThisMonth = await prisma.workflowLog.count({
    where: {
      createdAt: { gte: monthStart },
      status: { in: ["success", "failed"] }, // skipped = no Composio call
    },
  });

  const tierLimit = TIER_LIMITS[CURRENT_TIER];
  const percentUsed = tierLimit > 0 ? Math.round((callsThisMonth / tierLimit) * 100) : 0;
  const remainingCalls = Math.max(0, tierLimit - callsThisMonth);

  let warningLevel: UsageReport["warningLevel"] = "ok";
  if (percentUsed >= 100) warningLevel = "exceeded";
  else if (percentUsed >= 90) warningLevel = "urgent";
  else if (percentUsed >= 75) warningLevel = "watch";

  return {
    currentMonth,
    callsThisMonth,
    tierLimit,
    tier: CURRENT_TIER,
    percentUsed,
    remainingCalls,
    shouldUpgrade: percentUsed >= 80,
    warningLevel,
  };
}

/**
 * Check if we should block new workflow executions (tier exceeded).
 * Called by WorkflowEngine.fire() before executing.
 */
export async function canExecuteWorkflow(): Promise<boolean> {
  const usage = await getComposioUsage();
  if (usage.warningLevel === "exceeded") {
    console.error(
      `[Composio] TIER LIMIT EXCEEDED: ${usage.callsThisMonth}/${usage.tierLimit} calls this month. ` +
      `Upgrade at https://composio.dev/pricing to restore workflow automations.`
    );
    return false;
  }
  if (usage.warningLevel === "urgent") {
    console.warn(
      `[Composio] WARNING: ${usage.percentUsed}% of monthly limit used (${usage.callsThisMonth}/${usage.tierLimit}). ` +
      `Consider upgrading soon.`
    );
  }
  return true;
}
