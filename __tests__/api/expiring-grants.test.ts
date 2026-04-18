import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 5 P3a — schema + route-handler tests.
// Schema tests are pure zod; route tests mock Prisma + auth and
// exercise the create/extend/revoke flows including the self-
// extension rejection + AuditLog writes.
// ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  organizationMembership: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

async function mockSessionAs(user: {
  id: string;
  role: string;
  organizationId: string;
}) {
  const { auth } = await import("@/auth");
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user });
}

beforeEach(() => {
  vi.clearAllMocks();
});

const PLATFORM_ADMIN = {
  id: "admin-1",
  role: "platform_admin",
  organizationId: "platform-org",
};

// ──────────────────────────────────────────────────────────────────
// Schema tests
// ──────────────────────────────────────────────────────────────────

describe("createExpiringGrantSchema", () => {
  const baseInput = {
    userId: "user-1",
    organizationId: "org-1",
    role: "cpa" as const,
    grantReason: "Q1 audit — external CPA under signed engagement letter",
  };

  it("accepts a valid grant with expiresAt 30 days out", async () => {
    const { createExpiringGrantSchema } = await import(
      "@/lib/validations/expiring-grant"
    );
    const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
    const parsed = createExpiringGrantSchema.safeParse({
      ...baseInput,
      expiresAt,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects expiresAt in the past", async () => {
    const { createExpiringGrantSchema } = await import(
      "@/lib/validations/expiring-grant"
    );
    const expiresAt = new Date(Date.now() - 86400_000).toISOString();
    const parsed = createExpiringGrantSchema.safeParse({
      ...baseInput,
      expiresAt,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects expiresAt beyond the 180-day ceiling", async () => {
    const { createExpiringGrantSchema } = await import(
      "@/lib/validations/expiring-grant"
    );
    const expiresAt = new Date(Date.now() + 181 * 86400_000).toISOString();
    const parsed = createExpiringGrantSchema.safeParse({
      ...baseInput,
      expiresAt,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects grantReason shorter than 10 trimmed chars", async () => {
    const { createExpiringGrantSchema } = await import(
      "@/lib/validations/expiring-grant"
    );
    const parsed = createExpiringGrantSchema.safeParse({
      ...baseInput,
      expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
      grantReason: "  short  ",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("extendExpiringGrantSchema", () => {
  it("bounds the extension by NOW + 180 days, not by current expiresAt", async () => {
    const { extendExpiringGrantSchema } = await import(
      "@/lib/validations/expiring-grant"
    );
    // 181 days from now — even though a current grant might have days
    // remaining, an extension past now+180 is rejected.
    const expiresAt = new Date(Date.now() + 181 * 86400_000).toISOString();
    const parsed = extendExpiringGrantSchema.safeParse({
      expiresAt,
      extensionReason: "Audit scope expanded to include CA state filings",
    });
    expect(parsed.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// Route-handler tests — POST /api/platform/expiring-grants
// ──────────────────────────────────────────────────────────────────

describe("POST /api/platform/expiring-grants", () => {
  it("creates a membership and writes an AuditLog", async () => {
    await mockSessionAs(PLATFORM_ADMIN);
    // β check in requirePlatformAdmin
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce(null);
    // Existence check in POST (no prior membership)
    mockPrisma.organizationMembership.findUnique.mockResolvedValueOnce(null);
    mockPrisma.organizationMembership.create.mockResolvedValueOnce({
      id: "grant-1",
      userId: "target-user",
      organizationId: "target-org",
      role: "cpa",
      expiresAt: new Date(Date.now() + 30 * 86400_000),
      grantedBy: "admin-1",
      grantReason: "Q1 audit — external CPA under signed engagement letter",
      createdAt: new Date(),
    });
    mockPrisma.auditLog.create.mockResolvedValueOnce({ id: "al-1" });

    const { POST } = await import("@/app/api/platform/expiring-grants/route");
    const body = {
      userId: "target-user",
      organizationId: "target-org",
      role: "cpa",
      expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
      grantReason: "Q1 audit — external CPA under signed engagement letter",
    };
    const req = new Request("http://localhost/api/platform/expiring-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    expect(mockPrisma.organizationMembership.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    const auditPayload = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(auditPayload.action).toBe("grant_expiring_role");
    expect(auditPayload.entityType).toBe("organization_membership");
    expect(auditPayload.entityId).toBe("grant-1");
  });

  it("returns 409 when the user already has a membership", async () => {
    await mockSessionAs(PLATFORM_ADMIN);
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce(null);
    mockPrisma.organizationMembership.findUnique.mockResolvedValueOnce({
      id: "existing-1",
    });

    const { POST } = await import("@/app/api/platform/expiring-grants/route");
    const body = {
      userId: "target-user",
      organizationId: "target-org",
      role: "cpa",
      expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
      grantReason: "Q1 audit — external CPA under signed engagement letter",
    };
    const req = new Request("http://localhost/api/platform/expiring-grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(mockPrisma.organizationMembership.create).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// Route-handler tests — PATCH /api/platform/expiring-grants/[id]
// ──────────────────────────────────────────────────────────────────

describe("PATCH /api/platform/expiring-grants/[id]", () => {
  it("rejects self-extension with 403", async () => {
    await mockSessionAs(PLATFORM_ADMIN);
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce(null); // β pass
    mockPrisma.organizationMembership.findUnique.mockResolvedValueOnce({
      id: "grant-1",
      userId: PLATFORM_ADMIN.id, // same as session
      organizationId: "target-org",
      expiresAt: new Date(Date.now() + 5 * 86400_000),
      revokedAt: null,
    });

    const { PATCH } = await import(
      "@/app/api/platform/expiring-grants/[id]/route"
    );
    const body = {
      expiresAt: new Date(Date.now() + 90 * 86400_000).toISOString(),
      extensionReason: "Covering for team during audit extension period",
    };
    const req = new Request(
      "http://localhost/api/platform/expiring-grants/grant-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await PATCH(req, { params: Promise.resolve({ id: "grant-1" }) });
    expect(res.status).toBe(403);
    expect(mockPrisma.organizationMembership.update).not.toHaveBeenCalled();
  });

  it("rejects backwards expiresAt", async () => {
    await mockSessionAs(PLATFORM_ADMIN);
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce(null);
    const currentExpiresAt = new Date(Date.now() + 60 * 86400_000);
    mockPrisma.organizationMembership.findUnique.mockResolvedValueOnce({
      id: "grant-1",
      userId: "other-user",
      organizationId: "target-org",
      expiresAt: currentExpiresAt,
      revokedAt: null,
    });

    const { PATCH } = await import(
      "@/app/api/platform/expiring-grants/[id]/route"
    );
    const body = {
      expiresAt: new Date(Date.now() + 10 * 86400_000).toISOString(),
      extensionReason: "Intentionally moving expiresAt backwards — should reject",
    };
    const req = new Request(
      "http://localhost/api/platform/expiring-grants/grant-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await PATCH(req, { params: Promise.resolve({ id: "grant-1" }) });
    expect(res.status).toBe(400);
    expect(mockPrisma.organizationMembership.update).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// Route-handler tests — DELETE /api/platform/expiring-grants/[id]
// ──────────────────────────────────────────────────────────────────

describe("DELETE /api/platform/expiring-grants/[id]", () => {
  it("sets revokedAt + revokedBy and writes AuditLog", async () => {
    await mockSessionAs(PLATFORM_ADMIN);
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce(null);
    mockPrisma.organizationMembership.findUnique.mockResolvedValueOnce({
      id: "grant-1",
      userId: "other-user",
      organizationId: "target-org",
      expiresAt: new Date(Date.now() + 10 * 86400_000),
      revokedAt: null,
    });
    mockPrisma.organizationMembership.update.mockResolvedValueOnce({
      id: "grant-1",
      revokedAt: new Date(),
      revokedBy: PLATFORM_ADMIN.id,
    });
    mockPrisma.auditLog.create.mockResolvedValueOnce({ id: "al-1" });

    const { DELETE } = await import(
      "@/app/api/platform/expiring-grants/[id]/route"
    );
    const req = new Request(
      "http://localhost/api/platform/expiring-grants/grant-1",
      { method: "DELETE" },
    );

    const res = await DELETE(req, { params: Promise.resolve({ id: "grant-1" }) });
    expect(res.status).toBe(200);
    const updateCall = mockPrisma.organizationMembership.update.mock.calls[0][0];
    expect(updateCall.data.revokedAt).toBeInstanceOf(Date);
    expect(updateCall.data.revokedBy).toBe(PLATFORM_ADMIN.id);
    expect(updateCall.data.status).toBe("revoked");
    const auditPayload = mockPrisma.auditLog.create.mock.calls[0][0].data;
    expect(auditPayload.action).toBe("revoke_expiring_role");
  });
});
