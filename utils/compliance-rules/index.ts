// Compliance Rule Engine — Main Entry Point
// Classifies every expense request based on SSI/Medi-Cal rules.
// This is the product's soul. Treat changes here with extreme care.

import {
  classifyExpenseFederal,
  type ClassifiableExpense,
  type ExpenseClassification,
  type RiskLevel,
} from "./federal-ssi";
import { classifyExpenseCalifornia } from "./california";

export type { ClassifiableExpense, ExpenseClassification, RiskLevel };

export interface BenefitFlags {
  ssi: boolean;
  ssdi: boolean;
  mediCal: boolean;
  medicaid: boolean;
  able: boolean;
}

export interface ClassificationResult {
  level: RiskLevel;
  reason: string;
  rules: string[]; // Which rule sets were applied
}

/**
 * Classify an expense for compliance risk.
 * Applies federal SSI rules first, then state-specific overlays
 * based on the beneficiary's benefit flags.
 *
 * The most restrictive classification wins.
 */
export function classifyExpense(
  expense: ClassifiableExpense,
  benefitFlags?: BenefitFlags | null,
): ClassificationResult {
  const appliedRules: string[] = [];
  let result: ExpenseClassification;

  // Always apply federal SSI rules as baseline
  result = classifyExpenseFederal(expense);
  appliedRules.push("federal-ssi");

  // Apply California rules if beneficiary has Medi-Cal
  if (benefitFlags?.mediCal) {
    const caResult = classifyExpenseCalifornia(expense);
    if (caResult) {
      appliedRules.push("california-medi-cal");
      // Use the more restrictive classification
      if (isMoreRestrictive(caResult.level, result.level)) {
        result = caResult;
      }
    }
  }

  return {
    level: result.level,
    reason: result.reason,
    rules: appliedRules,
  };
}

/**
 * Risk severity ordering (most to least restrictive):
 * BLOCKED > LIKELY_RISKY > NEEDS_REVIEW > LIKELY_SAFE
 */
const RISK_ORDER: Record<RiskLevel, number> = {
  BLOCKED: 4,
  LIKELY_RISKY: 3,
  NEEDS_REVIEW: 2,
  LIKELY_SAFE: 1,
};

function isMoreRestrictive(a: RiskLevel, b: RiskLevel): boolean {
  return RISK_ORDER[a] > RISK_ORDER[b];
}
