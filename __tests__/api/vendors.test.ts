import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

// BSRS Ch 5 P2 — vendor rejection transitions the vendor to BLOCKED, which
// halts every future disbursement to them org-wide. The zod reason-gate is
// the first line of defense; these tests pin the gate shape so it cannot
// regress silently.
describe("Vendors API - Reject reason gate (BSRS Ch 5 P2)", () => {
  it("rejects an empty body", async () => {
    const { rejectVendorSchema } = await import("@/lib/validations/vendor");

    const result = rejectVendorSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty("reason");
    }
  });

  it("rejects a missing reason", async () => {
    const { rejectVendorSchema } = await import("@/lib/validations/vendor");

    const result = rejectVendorSchema.safeParse({ note: "some other field" });

    expect(result.success).toBe(false);
  });

  it("rejects a reason shorter than 10 characters", async () => {
    const { rejectVendorSchema } = await import("@/lib/validations/vendor");

    const result = rejectVendorSchema.safeParse({ reason: "too short" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("at least 10 characters"),
        ),
      ).toBe(true);
    }
  });

  it("rejects a reason that is exactly 9 characters", async () => {
    const { rejectVendorSchema } = await import("@/lib/validations/vendor");

    const result = rejectVendorSchema.safeParse({ reason: "123456789" });

    expect(result.success).toBe(false);
  });

  it("accepts a reason of exactly 10 characters", async () => {
    const { rejectVendorSchema } = await import("@/lib/validations/vendor");

    const result = rejectVendorSchema.safeParse({ reason: "1234567890" });

    expect(result.success).toBe(true);
  });

  it("accepts a substantive rejection reason", async () => {
    const { rejectVendorSchema } = await import("@/lib/validations/vendor");

    const result = rejectVendorSchema.safeParse({
      reason: "Vendor failed TIN verification after two attempts",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toMatch(/TIN verification/);
    }
  });
});
