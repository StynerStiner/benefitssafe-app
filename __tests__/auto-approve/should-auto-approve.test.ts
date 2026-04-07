import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing the module
vi.mock("@/lib/db", () => ({
  prisma: {
    disbursementPolicy: {
      findFirst: vi.fn(),
    },
  },
}));

import { shouldAutoApprove } from "@/lib/auto-approve";
import { prisma } from "@/lib/db";

const mockFindFirst = vi.mocked(prisma.disbursementPolicy.findFirst);

const baseParams = {
  organizationId: "org-123",
  amount: 50,
  riskClassification: "LIKELY_SAFE",
  categoryId: "cat-123",
};

function mockPolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: "policy-1",
    organizationId: "org-123",
    grantId: null,
    cashToRecipient: "DISALLOWED",
    reimbursementToRecipient: "DISALLOWED",
    rentUtilityPayments: "REQUIRES_REVIEW",
    recurringSubscriptions: "ALLOWED",
    maxSingleTransaction: null,
    allowedCategories: null,
    blockedCategories: null,
    autoApproveEnabled: true,
    autoApproveMaxAmount: 100,
    autoApproveRiskLevels: ["LIKELY_SAFE"],
    autoApproveCategories: null,
    requireReviewAbove: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("shouldAutoApprove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when no policy exists", async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await shouldAutoApprove(baseParams);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("not enabled");
  });

  it("rejects when auto-approve is disabled", async () => {
    mockFindFirst.mockResolvedValue(mockPolicy({ autoApproveEnabled: false }) as never);
    const result = await shouldAutoApprove(baseParams);
    expect(result.approved).toBe(false);
  });

  it("rejects when amount exceeds max", async () => {
    mockFindFirst.mockResolvedValue(mockPolicy({ autoApproveMaxAmount: 25 }) as never);
    const result = await shouldAutoApprove({ ...baseParams, amount: 50 });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("exceeds");
  });

  it("approves when amount exactly at max", async () => {
    mockFindFirst.mockResolvedValue(mockPolicy({ autoApproveMaxAmount: 50 }) as never);
    const result = await shouldAutoApprove({ ...baseParams, amount: 50 });
    expect(result.approved).toBe(true);
  });

  it("rejects when risk level not in allowed list", async () => {
    mockFindFirst.mockResolvedValue(mockPolicy() as never);
    const result = await shouldAutoApprove({ ...baseParams, riskClassification: "NEEDS_REVIEW" });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("manual review");
  });

  it("approves LIKELY_SAFE when policy allows", async () => {
    mockFindFirst.mockResolvedValue(mockPolicy() as never);
    const result = await shouldAutoApprove(baseParams);
    expect(result.approved).toBe(true);
  });

  it("rejects when category not in allowed list", async () => {
    mockFindFirst.mockResolvedValue(
      mockPolicy({ autoApproveCategories: ["cat-999"] }) as never,
    );
    const result = await shouldAutoApprove(baseParams);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("category");
  });

  it("approves when category is in allowed list", async () => {
    mockFindFirst.mockResolvedValue(
      mockPolicy({ autoApproveCategories: ["cat-123", "cat-456"] }) as never,
    );
    const result = await shouldAutoApprove(baseParams);
    expect(result.approved).toBe(true);
  });

  it("rejects when amount exceeds review threshold", async () => {
    mockFindFirst.mockResolvedValue(
      mockPolicy({ requireReviewAbove: 30 }) as never,
    );
    const result = await shouldAutoApprove({ ...baseParams, amount: 50 });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("review threshold");
  });
});
