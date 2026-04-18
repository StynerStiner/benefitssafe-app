import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
// P3a β check uses prisma.organizationMembership.findFirst inside
// requirePlatformAdmin. The existing tests that exercise that helper
// don't care about the β check; mocking the lookup to return null keeps
// the permanent-grant path live (null membership = pass-through) so
// none of the pre-P3a assertions change.
vi.mock("@/lib/db", () => ({
  prisma: {
    organizationMembership: {
      findFirst: vi.fn(() => Promise.resolve(null)),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function mockSession(
  session: { user: { id: string; role: string; organizationId: string } } | null,
) {
  return async () => {
    const { auth } = await import("@/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(session);
  };
}

describe("GuardDenial (BSRS Ch 5 P4.2)", () => {
  it("is an Error subclass with kind/route/userId fields", async () => {
    const { GuardDenial } = await import("@/lib/auth-guard");
    const d = new GuardDenial({
      kind: "forbidden",
      message: "Forbidden",
      route: "api/test:GET",
      method: "GET",
      userId: "u-1",
      organizationId: "o-1",
    });

    expect(d).toBeInstanceOf(Error);
    expect(d.name).toBe("GuardDenial");
    expect(d.kind).toBe("forbidden");
    expect(d.route).toBe("api/test:GET");
    expect(d.userId).toBe("u-1");
    expect(d.organizationId).toBe("o-1");
    expect(d.message).toBe("Forbidden");
    expect(d.denialMessage).toBe("Forbidden");
  });

  it("toErrorResponse() produces a NextResponse with correlationId", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { GuardDenial } = await import("@/lib/auth-guard");

    const d = new GuardDenial({
      kind: "forbidden",
      message: "Forbidden",
      route: "api/test:GET",
      method: "GET",
      userId: "u-1",
      organizationId: "o-1",
    });
    const res = d.toErrorResponse();

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(body.correlationId).toMatch(/^req_[A-Za-z0-9_-]{8}$/);
  });
});

describe("requireAuth (BSRS Ch 5 P4.2)", () => {
  it("throws GuardDenial(unauthorized, 401) when session is null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSession(null)();
    const { requireAuth, GuardDenial } = await import("@/lib/auth-guard");

    let caught: unknown;
    try {
      await requireAuth("api/test:GET", "GET");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GuardDenial);
    expect((caught as InstanceType<typeof GuardDenial>).kind).toBe("unauthorized");
    expect((caught as InstanceType<typeof GuardDenial>).userId).toBeNull();
    expect((caught as InstanceType<typeof GuardDenial>).organizationId).toBeNull();
  });

  it("throws GuardDenial(unauthorized) when session has no user", async () => {
    const { auth } = await import("@/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ user: null });
    const { requireAuth, GuardDenial } = await import("@/lib/auth-guard");

    await expect(requireAuth("api/test:GET")).rejects.toBeInstanceOf(GuardDenial);
  });

  it("returns GuardContext with userId/organizationId/role when authenticated", async () => {
    await mockSession({
      user: { id: "user-7", role: "nonprofit_admin", organizationId: "org-7" },
    })();
    const { requireAuth } = await import("@/lib/auth-guard");

    const ctx = await requireAuth("api/test:GET", "GET");

    expect(ctx.userId).toBe("user-7");
    expect(ctx.organizationId).toBe("org-7");
    expect(ctx.role).toBe("nonprofit_admin");
    expect(ctx.user.id).toBe("user-7");
  });
});

describe("requireRole (BSRS Ch 5 P4.2)", () => {
  it("passes through when role is in allowedRoles", async () => {
    const { requireRole } = await import("@/lib/auth-guard");
    const ctx = {
      session: {} as never,
      user: { id: "u", role: "cpa", organizationId: "o" } as never,
      userId: "u",
      organizationId: "o",
      role: "cpa",
    };

    const out = requireRole(ctx, ["cpa", "auditor"], "api/test:GET", "GET");
    expect(out).toBe(ctx);
  });

  it("throws GuardDenial(forbidden) when role is not in list", async () => {
    const { requireRole, GuardDenial } = await import("@/lib/auth-guard");
    const ctx = {
      session: {} as never,
      user: { id: "u", role: "beneficiary", organizationId: "o" } as never,
      userId: "u",
      organizationId: "o",
      role: "beneficiary",
    };

    expect(() =>
      requireRole(ctx, ["nonprofit_admin", "platform_admin"], "api/test:POST", "POST"),
    ).toThrow(GuardDenial);
  });

  it("forwards userId/organizationId from ctx into the denial", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { requireRole, GuardDenial } = await import("@/lib/auth-guard");
    const ctx = {
      session: {} as never,
      user: {} as never,
      userId: "ctx-user",
      organizationId: "ctx-org",
      role: "vendor",
    };

    let caught: unknown;
    try {
      requireRole(ctx, ["nonprofit_admin"], "api/test:POST", "POST");
    } catch (err) {
      caught = err;
    }
    const denial = caught as InstanceType<typeof GuardDenial>;
    expect(denial.userId).toBe("ctx-user");
    expect(denial.organizationId).toBe("ctx-org");
  });
});

describe("requireAdmin (BSRS Ch 5 P4.2)", () => {
  it("allows nonprofit_admin", async () => {
    await mockSession({
      user: { id: "u", role: "nonprofit_admin", organizationId: "o" },
    })();
    const { requireAdmin } = await import("@/lib/auth-guard");

    const ctx = await requireAdmin("api/test:POST", "POST");
    expect(ctx.role).toBe("nonprofit_admin");
  });

  it("allows platform_admin", async () => {
    await mockSession({
      user: { id: "u", role: "platform_admin", organizationId: "o" },
    })();
    const { requireAdmin } = await import("@/lib/auth-guard");

    const ctx = await requireAdmin("api/test:POST", "POST");
    expect(ctx.role).toBe("platform_admin");
  });

  it("denies beneficiary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSession({
      user: { id: "u", role: "beneficiary", organizationId: "o" },
    })();
    const { requireAdmin, GuardDenial } = await import("@/lib/auth-guard");

    await expect(requireAdmin("api/test:POST")).rejects.toBeInstanceOf(GuardDenial);
  });

  it("denies vendor", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSession({
      user: { id: "u", role: "vendor", organizationId: "o" },
    })();
    const { requireAdmin, GuardDenial } = await import("@/lib/auth-guard");

    await expect(requireAdmin("api/test:POST")).rejects.toBeInstanceOf(GuardDenial);
  });

  it("denies nonprofit_staff (this helper is admin-only)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSession({
      user: { id: "u", role: "nonprofit_staff", organizationId: "o" },
    })();
    const { requireAdmin, GuardDenial } = await import("@/lib/auth-guard");

    await expect(requireAdmin("api/test:POST")).rejects.toBeInstanceOf(GuardDenial);
  });
});

describe("requirePlatformAdmin (BSRS Ch 5 P4.2)", () => {
  it("allows only platform_admin", async () => {
    await mockSession({
      user: { id: "u", role: "platform_admin", organizationId: "SYSTEM" },
    })();
    const { requirePlatformAdmin } = await import("@/lib/auth-guard");

    const ctx = await requirePlatformAdmin("api/platform/test:GET", "GET");
    expect(ctx.role).toBe("platform_admin");
  });

  it("denies nonprofit_admin", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSession({
      user: { id: "u", role: "nonprofit_admin", organizationId: "o" },
    })();
    const { requirePlatformAdmin, GuardDenial } = await import("@/lib/auth-guard");

    await expect(
      requirePlatformAdmin("api/platform/test:GET"),
    ).rejects.toBeInstanceOf(GuardDenial);
  });
});

describe("requireNonprofitStaff (BSRS Ch 5 P4.2)", () => {
  it("allows nonprofit_admin + nonprofit_staff + platform_admin", async () => {
    const roles = ["nonprofit_admin", "nonprofit_staff", "platform_admin"];
    for (const role of roles) {
      vi.clearAllMocks();
      await mockSession({ user: { id: "u", role, organizationId: "o" } })();
      const { requireNonprofitStaff } = await import("@/lib/auth-guard");
      const ctx = await requireNonprofitStaff("api/beneficiaries:GET", "GET");
      expect(ctx.role).toBe(role);
    }
  });

  it("denies cpa and beneficiary and vendor", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const role of ["cpa", "beneficiary", "vendor"]) {
      vi.clearAllMocks();
      await mockSession({ user: { id: "u", role, organizationId: "o" } })();
      const { requireNonprofitStaff, GuardDenial } = await import("@/lib/auth-guard");
      await expect(
        requireNonprofitStaff("api/beneficiaries:GET", "GET"),
      ).rejects.toBeInstanceOf(GuardDenial);
    }
  });
});

describe("requireNonVendor (BSRS Ch 5 P4.2)", () => {
  it("allows every role except vendor", async () => {
    const nonVendorRoles = [
      "nonprofit_admin",
      "nonprofit_staff",
      "beneficiary",
      "cpa",
      "auditor",
      "attorney",
      "platform_admin",
      "compliance_officer",
      "grant_officer",
      "support_agent",
      "billing_admin",
    ];
    for (const role of nonVendorRoles) {
      vi.clearAllMocks();
      await mockSession({ user: { id: "u", role, organizationId: "o" } })();
      const { requireNonVendor } = await import("@/lib/auth-guard");
      const ctx = await requireNonVendor("api/grants/[id]:GET", "GET");
      expect(ctx.role).toBe(role);
    }
  });

  it("denies vendor specifically", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSession({
      user: { id: "u", role: "vendor", organizationId: "o" },
    })();
    const { requireNonVendor, GuardDenial } = await import("@/lib/auth-guard");

    await expect(requireNonVendor("api/grants/[id]:GET", "GET")).rejects.toBeInstanceOf(
      GuardDenial,
    );
  });
});

describe("guard denial log payload (BSRS Ch 5 P4.2 × P4.1 integration)", () => {
  it("emits [api_error] stdout line with route + kind when denial is converted", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mockSession({
      user: { id: "u-777", role: "beneficiary", organizationId: "org-777" },
    })();
    const { requireAdmin, GuardDenial } = await import("@/lib/auth-guard");

    let caught: unknown;
    try {
      await requireAdmin("api/grants:POST", "POST");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GuardDenial);
    const denial = caught as InstanceType<typeof GuardDenial>;
    // Converting to response is what triggers the structured log line
    const res = denial.toErrorResponse();
    expect(res.status).toBe(403);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe("[api_error]");
    const payload = JSON.parse(spy.mock.calls[0][1] as string);
    expect(payload.route).toBe("api/grants:POST");
    expect(payload.kind).toBe("forbidden");
    expect(payload.userId).toBe("u-777");
    expect(payload.organizationId).toBe("org-777");
  });
});
