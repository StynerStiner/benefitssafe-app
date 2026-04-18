import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 5 P3a — hourly cron. Enforcement is NOT dependent on this
// cron (α + β gates check expiresAt at request time), so the cron's
// only job is to stamp revokedAt + write an AuditLog for historical
// record-keeping. Must be idempotent: re-running against already-
// revoked grants is a no-op because the WHERE filter excludes rows
// where revokedAt IS NOT NULL.
// ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  organizationMembership: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

function request(authHeader?: string): Request {
  return new Request(
    "http://localhost/api/cron/revoke-expired-grants",
    authHeader
      ? { headers: { authorization: authHeader } }
      : {},
  );
}

describe("GET /api/cron/revoke-expired-grants", () => {
  it("returns 401 when the bearer token does not match CRON_SECRET", async () => {
    const { GET } = await import(
      "@/app/api/cron/revoke-expired-grants/route"
    );
    const res = await GET(request("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(mockPrisma.organizationMembership.findMany).not.toHaveBeenCalled();
  });

  it("returns { revoked: 0 } when no grants are expired", async () => {
    mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([]);

    const { GET } = await import(
      "@/app/api/cron/revoke-expired-grants/route"
    );
    const res = await GET(request("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revoked).toBe(0);
    expect(body.scanned).toBe(0);
    expect(mockPrisma.organizationMembership.update).not.toHaveBeenCalled();
  });

  it("revokes each expired grant and writes an AuditLog per grant", async () => {
    const past = new Date(Date.now() - 86400_000);
    mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([
      { id: "g1", userId: "u1", organizationId: "o1", expiresAt: past },
      { id: "g2", userId: "u2", organizationId: "o2", expiresAt: past },
    ]);
    mockPrisma.organizationMembership.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const { GET } = await import(
      "@/app/api/cron/revoke-expired-grants/route"
    );
    const res = await GET(request("Bearer test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.revoked).toBe(2);
    expect(body.scanned).toBe(2);
    expect(mockPrisma.organizationMembership.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2);

    // Every AuditLog for a cron-driven revocation carries the system
    // sentinel userId and a null revokedBy in newValue.
    const firstAudit = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(firstAudit.action).toBe("auto_revoke_expiring_role");
    expect(firstAudit.userId).toBe("system:cron:revoke-expired-grants");
    expect(firstAudit.newValue.revokedBy).toBeNull();
  });

  it("is idempotent — second run sees no expired grants (findMany filters revokedAt IS NULL)", async () => {
    // First run: 1 expired grant.
    mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([
      {
        id: "g1",
        userId: "u1",
        organizationId: "o1",
        expiresAt: new Date(Date.now() - 60_000),
      },
    ]);
    mockPrisma.organizationMembership.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const { GET } = await import(
      "@/app/api/cron/revoke-expired-grants/route"
    );
    let res = await GET(request("Bearer test-secret"));
    let body = await res.json();
    expect(body.revoked).toBe(1);

    // Second run: findMany returns [] because already-revoked rows are
    // filtered out by the `revokedAt: null` clause.
    mockPrisma.organizationMembership.findMany.mockResolvedValueOnce([]);
    res = await GET(request("Bearer test-secret"));
    body = await res.json();
    expect(body.revoked).toBe(0);
    expect(body.scanned).toBe(0);

    // Also verify the findMany WHERE clause includes revokedAt: null.
    const call = mockPrisma.organizationMembership.findMany.mock.calls[0][0];
    expect(call.where.revokedAt).toBeNull();
  });
});
