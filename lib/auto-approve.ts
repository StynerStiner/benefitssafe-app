import { prisma } from "@/lib/db";

interface AutoApproveParams {
  organizationId: string;
  amount: number;
  riskClassification: string;
  categoryId?: string;
}

interface AutoApproveResult {
  approved: boolean;
  reason: string;
}

export async function shouldAutoApprove(
  params: AutoApproveParams
): Promise<AutoApproveResult> {
  const { organizationId, amount, riskClassification, categoryId } = params;

  // 1. Look up the org's disbursement policy (org-wide, grantId = null)
  const policy = await prisma.disbursementPolicy.findFirst({
    where: { organizationId, grantId: null },
  });

  // 2. No policy or auto-approve disabled
  if (!policy || !policy.autoApproveEnabled) {
    return { approved: false, reason: "Auto-approval not enabled for this organization" };
  }

  // 3. Check amount against max auto-approve limit
  if (policy.autoApproveMaxAmount !== null) {
    const maxAmount = Number(policy.autoApproveMaxAmount);
    if (amount > maxAmount) {
      return { approved: false, reason: `Amount $${amount.toFixed(2)} exceeds auto-approve limit of $${maxAmount.toFixed(2)}` };
    }
  }

  // 4. Check if amount requires manual review
  if (policy.requireReviewAbove !== null) {
    const reviewThreshold = Number(policy.requireReviewAbove);
    if (amount > reviewThreshold) {
      return { approved: false, reason: `Amount $${amount.toFixed(2)} exceeds review threshold of $${reviewThreshold.toFixed(2)}` };
    }
  }

  // 5. Check risk level against allowed risk levels
  const allowedRiskLevels = (policy.autoApproveRiskLevels as string[] | null) ?? ["LIKELY_SAFE"];
  if (!allowedRiskLevels.includes(riskClassification)) {
    return { approved: false, reason: `Risk level "${riskClassification}" requires manual review` };
  }

  // 6. Check category against allowed categories (if configured)
  const allowedCategories = policy.autoApproveCategories as string[] | null;
  if (allowedCategories && allowedCategories.length > 0 && categoryId) {
    if (!allowedCategories.includes(categoryId)) {
      return { approved: false, reason: "Expense category not eligible for auto-approval" };
    }
  }

  // 7. All checks passed
  return { approved: true, reason: "Policy allows auto-approval" };
}
