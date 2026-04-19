import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/lib/db-health", () => ({
  assertDbHealthy: vi.fn(() => Promise.resolve()),
  DbUnavailableError: class extends Error {
    cooldown_ms_remaining = 30_000;
  },
}));

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

// BSRS Ch 5 P4.1 — every API error response carries a correlationId so an
// operator can tie a user-reported failure to a structured server log line.
describe("Vendors API - Error correlation IDs (BSRS Ch 5 P4.1)", () => {
  it("POST /api/vendors/[id]/reject unauthorized response includes correlationId", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { auth } = await import("@/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const mod = await import("@/app/api/vendors/[id]/reject/route");
    const res = await mod.POST(
      new Request("http://localhost/api/vendors/vendor-1/reject", {
        method: "POST",
        body: JSON.stringify({ reason: "not needed for 401 path" }),
      }),
      { params: Promise.resolve({ id: "vendor-1" }) },
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(body.correlationId).toMatch(/^req_[A-Za-z0-9_-]{8}$/);
  });
});
