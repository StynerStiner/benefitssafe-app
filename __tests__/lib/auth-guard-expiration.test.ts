import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 5 P3a — β gate. requirePlatformAdmin performs a per-
// request DB re-check of the caller's OrganizationMembership so an
// expired or revoked grant is rejected immediately, not after the
// next JWT refresh (≤15 min window closes the α gate but that's
// too wide for a breakglass role).
// ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  organizationMembership: {
    findFirst: vi.fn(),
  },
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

describe("requirePlatformAdmin — P3a β gate", () => {
  it("passes when there is no OrganizationMembership row (legacy seeded admin)", async () => {
    await mockSessionAs({
      id: "pa-1",
      role: "platform_admin",
      organizationId: "platform-org",
    });
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce(null);

    const { requirePlatformAdmin } = await import("@/lib/auth-guard");
    const ctx = await requirePlatformAdmin("api/test:GET", "GET");
    expect(ctx.role).toBe("platform_admin");
  });

  it("passes when membership has no expiresAt (permanent grant)", async () => {
    await mockSessionAs({
      id: "pa-1",
      role: "platform_admin",
      organizationId: "platform-org",
    });
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce({
      expiresAt: null,
      revokedAt: null,
    });

    const { requirePlatformAdmin } = await import("@/lib/auth-guard");
    const ctx = await requirePlatformAdmin("api/test:GET", "GET");
    expect(ctx.role).toBe("platform_admin");
  });

  it("passes when membership expiresAt is in the future and revokedAt is null", async () => {
    await mockSessionAs({
      id: "pa-1",
      role: "platform_admin",
      organizationId: "platform-org",
    });
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() + 7 * 86400_000),
      revokedAt: null,
    });

    const { requirePlatformAdmin } = await import("@/lib/auth-guard");
    const ctx = await requirePlatformAdmin("api/test:GET", "GET");
    expect(ctx.role).toBe("platform_admin");
  });

  it("throws GuardDenial(forbidden) when expiresAt has passed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSessionAs({
      id: "pa-1",
      role: "platform_admin",
      organizationId: "platform-org",
    });
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() - 60_000), // expired 1 minute ago
      revokedAt: null,
    });

    const { requirePlatformAdmin, GuardDenial } = await import(
      "@/lib/auth-guard"
    );
    let caught: unknown;
    try {
      await requirePlatformAdmin("api/test:GET", "GET");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GuardDenial);
    const d = caught as InstanceType<typeof GuardDenial>;
    expect(d.kind).toBe("forbidden");
    expect(d.denialMessage).toBe("Grant expired or revoked");
  });

  it("throws GuardDenial(forbidden) when revokedAt is set", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSessionAs({
      id: "pa-1",
      role: "platform_admin",
      organizationId: "platform-org",
    });
    mockPrisma.organizationMembership.findFirst.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() + 7 * 86400_000),
      revokedAt: new Date(Date.now() - 60_000),
    });

    const { requirePlatformAdmin, GuardDenial } = await import(
      "@/lib/auth-guard"
    );
    let caught: unknown;
    try {
      await requirePlatformAdmin("api/test:GET", "GET");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GuardDenial);
    expect((caught as InstanceType<typeof GuardDenial>).kind).toBe("forbidden");
  });

  it("rejects non-platform-admin roles before the β check runs", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSessionAs({
      id: "np-1",
      role: "nonprofit_admin",
      organizationId: "org-1",
    });

    const { requirePlatformAdmin, GuardDenial } = await import(
      "@/lib/auth-guard"
    );
    let caught: unknown;
    try {
      await requirePlatformAdmin("api/test:GET", "GET");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GuardDenial);
    expect(mockPrisma.organizationMembership.findFirst).not.toHaveBeenCalled();
  });
});
