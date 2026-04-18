import { describe, it, expect } from "vitest";
import { updateBeneficiarySchema } from "@/lib/validations/beneficiary";

// BSRS Ch 5 §5.3: deactivation (irreversible state change on a human subject)
// requires a justification ≥10 chars. Reactivation and profile-only edits
// remain unchanged — the superRefine must not fire for them.
describe("updateBeneficiarySchema — deactivation reason gate (BSRS Ch 5 P2b)", () => {
  it("rejects deactivation with no reason", () => {
    const result = updateBeneficiarySchema.safeParse({ isActive: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      const reasonIssues = result.error.issues.filter((i) =>
        i.path.includes("reason"),
      );
      expect(reasonIssues.length).toBeGreaterThan(0);
    }
  });

  it("rejects deactivation with reason shorter than 10 trimmed chars", () => {
    const result = updateBeneficiarySchema.safeParse({
      isActive: false,
      reason: "  ok  ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const reasonIssues = result.error.issues.filter((i) =>
        i.path.includes("reason"),
      );
      expect(reasonIssues.length).toBeGreaterThan(0);
    }
  });

  it("accepts deactivation with a valid reason (≥10 chars)", () => {
    const result = updateBeneficiarySchema.safeParse({
      isActive: false,
      reason: "Beneficiary moved out of state, contact lost",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe(
        "Beneficiary moved out of state, contact lost",
      );
      expect(result.data.isActive).toBe(false);
    }
  });

  it("accepts profile-only edit (no isActive field) without a reason", () => {
    const result = updateBeneficiarySchema.safeParse({
      firstName: "Jane",
      phone: "555-1234",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Jane");
      expect(result.data.reason).toBeUndefined();
    }
  });
});
