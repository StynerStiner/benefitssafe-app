// California-Specific SSI/Medi-Cal Compliance Rules
// California supplements federal SSI with a State Supplementary Payment (SSP).
// Medi-Cal (California's Medicaid) has its own asset and income limits.
// These rules layer on top of federal SSI rules for California beneficiaries.

import type { ClassifiableExpense, ExpenseClassification } from "./federal-ssi";

// California Medi-Cal asset limit (2026): $130,000 for individuals
// SSI income limit: Federal Benefit Rate + California SSP
// These thresholds inform risk level but the classifier focuses on expense type.

// California-specific high-risk expense patterns
const CA_HIGH_RISK_KEYWORDS = [
  // Medi-Cal share of cost triggers
  "share of cost", "medi-cal premium",
  // CalFresh interaction
  "calfresh", "ebt", "snap benefits",
  // IHSS interaction
  "ihss", "in-home supportive",
];

const CA_ABLE_KEYWORDS = [
  "able account", "calable", "able savings",
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function combinedText(expense: ClassifiableExpense): string {
  return `${expense.expenseType} ${expense.description} ${expense.category}`.toLowerCase();
}

export function classifyExpenseCalifornia(expense: ClassifiableExpense): ExpenseClassification | null {
  const text = combinedText(expense);

  // Check for ABLE account contributions — generally safe
  if (matchesKeywords(text, CA_ABLE_KEYWORDS)) {
    return {
      level: "NEEDS_REVIEW",
      reason:
        "ABLE account contributions may be safe but have annual limits ($18,000 base + earned income exception). Verify contribution limits before proceeding.",
    };
  }

  // Check for California-specific high-risk patterns
  if (matchesKeywords(text, CA_HIGH_RISK_KEYWORDS)) {
    return {
      level: "LIKELY_RISKY",
      reason:
        "This expense may interact with California-specific benefit programs (Medi-Cal, CalFresh, IHSS). Consult a California benefits attorney.",
    };
  }

  // Return null if no California-specific rule applies — fall through to federal rules
  return null;
}
