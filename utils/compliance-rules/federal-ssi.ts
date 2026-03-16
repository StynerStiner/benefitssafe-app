// Federal SSI Compliance Rules
// These rules implement SSA guidelines for determining whether an expense
// paid from a restricted grant fund could affect a beneficiary's SSI eligibility.
//
// SSI counts most income (cash or in-kind) toward the Federal Benefit Rate.
// The goal: pay vendors directly for non-food, non-shelter items so the
// beneficiary never "receives" anything SSA would count as income.

export type RiskLevel = "LIKELY_SAFE" | "NEEDS_REVIEW" | "LIKELY_RISKY" | "BLOCKED";

export interface ExpenseClassification {
  level: RiskLevel;
  reason: string;
}

export interface ClassifiableExpense {
  expenseType: string;
  description: string;
  vendorType: string;
  amount: number;
  category: string;
  frequency: string;
}

// Keywords that indicate cash or cash-equivalent payments
const CASH_KEYWORDS = [
  "cash", "gift card", "visa gift", "mastercard gift", "prepaid card",
  "money order", "wire transfer to beneficiary", "venmo", "zelle",
  "paypal to beneficiary", "cash app", "direct payment to beneficiary",
  "stipend", "allowance",
];

// Keywords for generic prepaid/gift cards
const PREPAID_KEYWORDS = [
  "prepaid", "gift card", "visa gift", "mastercard gift", "amex gift",
  "amazon gift card", "target gift card", "walmart gift card",
  "generic card", "store credit",
];

// Keywords for shelter-related expenses (ISM - In-Kind Support and Maintenance)
const SHELTER_KEYWORDS = [
  "rent", "mortgage", "utilities", "electric", "electricity", "gas bill",
  "water bill", "sewer", "trash", "garbage", "heating", "cooling",
  "property tax", "property insurance", "homeowner", "housing",
  "apartment", "lease", "landlord",
];

// Keywords for food-related expenses
const FOOD_KEYWORDS = [
  "food", "grocery", "groceries", "meal", "meals", "restaurant",
  "dining", "catering", "food delivery", "doordash", "ubereats",
  "grubhub", "snack", "lunch", "dinner", "breakfast",
];

// Keywords indicating reimbursement to the beneficiary personally
const REIMBURSEMENT_KEYWORDS = [
  "reimbursement", "reimburse", "repay", "pay back",
  "refund to beneficiary", "direct to beneficiary",
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function combinedText(expense: ClassifiableExpense): string {
  return `${expense.expenseType} ${expense.description} ${expense.category}`.toLowerCase();
}

export function isCashOrCashEquivalent(expense: ClassifiableExpense): boolean {
  return matchesKeywords(combinedText(expense), CASH_KEYWORDS);
}

export function isGenericPrepaidCard(expense: ClassifiableExpense): boolean {
  return matchesKeywords(combinedText(expense), PREPAID_KEYWORDS);
}

export function isShelterExpense(expense: ClassifiableExpense): boolean {
  return matchesKeywords(combinedText(expense), SHELTER_KEYWORDS);
}

export function isFoodExpense(expense: ClassifiableExpense): boolean {
  return matchesKeywords(combinedText(expense), FOOD_KEYWORDS);
}

export function isReimbursementToRecipient(expense: ClassifiableExpense): boolean {
  return matchesKeywords(combinedText(expense), REIMBURSEMENT_KEYWORDS);
}

export function isDirectVendorPayment(expense: ClassifiableExpense): boolean {
  // If a vendor type is specified and it's not a reimbursement, it's a direct vendor payment
  const hasVendor = expense.vendorType !== "" && expense.vendorType !== "none";
  const notReimbursement = !isReimbursementToRecipient(expense);
  return hasVendor && notReimbursement;
}

export function classifyExpenseFederal(expense: ClassifiableExpense): ExpenseClassification {
  // BLOCKED: Cash or cash-equivalent to beneficiary
  if (isCashOrCashEquivalent(expense)) {
    return {
      level: "BLOCKED",
      reason:
        "Cash or cash-equivalent payments to beneficiary are not allowed. SSA treats these as income for SSI.",
    };
  }

  // BLOCKED: Generic prepaid card, Visa gift card
  if (isGenericPrepaidCard(expense)) {
    return {
      level: "BLOCKED",
      reason: "Generic prepaid cards are treated as cash equivalents by SSA.",
    };
  }

  // LIKELY_RISKY: Rent, mortgage, utilities (ISM — In-Kind Support and Maintenance)
  if (isShelterExpense(expense)) {
    return {
      level: "LIKELY_RISKY",
      reason:
        "Shelter payments (rent, mortgage, utilities) can reduce SSI benefits under ISM rules. Requires attorney review.",
    };
  }

  // NEEDS_REVIEW: Reimbursement to beneficiary
  if (isReimbursementToRecipient(expense)) {
    return {
      level: "NEEDS_REVIEW",
      reason:
        "Reimbursements paid directly to the beneficiary are risky for SSI. Prefer direct vendor payment.",
    };
  }

  // LIKELY_SAFE: Direct vendor payment for non-shelter, non-food items
  if (isDirectVendorPayment(expense) && !isFoodExpense(expense) && !isShelterExpense(expense)) {
    return {
      level: "LIKELY_SAFE",
      reason:
        "Direct payment to vendor for project expenses (not food or shelter) is generally safe for SSI.",
    };
  }

  // NEEDS_REVIEW: Food-related expenses
  if (isFoodExpense(expense)) {
    return {
      level: "NEEDS_REVIEW",
      reason:
        "Food-related expenses may count as In-Kind Support and Maintenance for SSI. Review current SSA rules.",
    };
  }

  // Default: NEEDS_REVIEW
  return {
    level: "NEEDS_REVIEW",
    reason:
      "Expense does not match a known safe or risky pattern. Manual review recommended.",
  };
}
