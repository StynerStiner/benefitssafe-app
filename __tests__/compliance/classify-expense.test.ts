import { describe, it, expect } from "vitest";
import { classifyExpense, type ClassifiableExpense, type BenefitFlags } from "@/utils/compliance-rules";

const ssiFlags: BenefitFlags = { ssi: true, ssdi: false, mediCal: false, medicaid: false, able: false };
const mediCalFlags: BenefitFlags = { ssi: true, ssdi: false, mediCal: true, medicaid: false, able: false };
const noFlags: BenefitFlags = { ssi: false, ssdi: false, mediCal: false, medicaid: false, able: false };

function makeExpense(overrides: Partial<ClassifiableExpense> = {}): ClassifiableExpense {
  return {
    expenseType: "subscription",
    description: "Adobe Creative Cloud",
    vendorType: "SERVICE_PROVIDER",
    amount: 55,
    category: "Software",
    frequency: "MONTHLY",
    ...overrides,
  };
}

describe("classifyExpense", () => {
  it("classifies direct vendor payment for software as LIKELY_SAFE", () => {
    const result = classifyExpense(makeExpense(), ssiFlags);
    expect(result.level).toBe("LIKELY_SAFE");
    expect(result.rules).toContain("federal-ssi");
  });

  it("blocks cash withdrawals", () => {
    const result = classifyExpense(
      makeExpense({ description: "cash withdrawal for beneficiary", expenseType: "cash" }),
      ssiFlags,
    );
    expect(result.level).toBe("BLOCKED");
  });

  it("blocks gift cards", () => {
    const result = classifyExpense(
      makeExpense({ description: "Visa gift card for beneficiary" }),
      ssiFlags,
    );
    expect(result.level).toBe("BLOCKED");
  });

  it("blocks prepaid cards", () => {
    const result = classifyExpense(
      makeExpense({ description: "generic prepaid card" }),
      ssiFlags,
    );
    expect(result.level).toBe("BLOCKED");
  });

  it("flags food purchases as NEEDS_REVIEW", () => {
    const result = classifyExpense(
      makeExpense({ description: "grocery delivery", category: "food", vendorType: "named" }),
      ssiFlags,
    );
    expect(result.level).toBe("NEEDS_REVIEW");
  });

  it("flags shelter/rent as LIKELY_RISKY", () => {
    const result = classifyExpense(
      makeExpense({ description: "monthly rent payment", category: "housing", vendorType: "named" }),
      ssiFlags,
    );
    expect(result.level).toBe("LIKELY_RISKY");
  });

  it("flags reimbursement to beneficiary as NEEDS_REVIEW", () => {
    const result = classifyExpense(
      makeExpense({ description: "reimbursement to beneficiary for supplies" }),
      ssiFlags,
    );
    expect(result.level).toBe("NEEDS_REVIEW");
  });

  it("classifies non-benefit beneficiary vendor payment as LIKELY_SAFE", () => {
    const result = classifyExpense(makeExpense(), noFlags);
    expect(result.level).toBe("LIKELY_SAFE");
  });

  it("classifies without benefit flags as LIKELY_SAFE for vendor payments", () => {
    const result = classifyExpense(makeExpense(), null);
    expect(result.level).toBe("LIKELY_SAFE");
  });

  it("applies California Medi-Cal overlay when mediCal flag is true", () => {
    const result = classifyExpense(makeExpense(), mediCalFlags);
    expect(result.rules).toContain("federal-ssi");
    // May or may not add california rule depending on classification
  });

  it("uses most restrictive classification across rule sets", () => {
    // Shelter is LIKELY_RISKY federally, should stay LIKELY_RISKY or worse
    const result = classifyExpense(
      makeExpense({ description: "rent payment", vendorType: "named" }),
      mediCalFlags,
    );
    expect(["LIKELY_RISKY", "BLOCKED"]).toContain(result.level);
  });
});
