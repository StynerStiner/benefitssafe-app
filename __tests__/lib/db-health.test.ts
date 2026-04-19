import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 8 P2a — Aurora health probe tests.
//
// Fake timers run Date.now(), setTimeout, and the module-level cache
// TTL math in virtual time. Pattern matches P1a's stripe-circuit test
// file: mock @/lib/db + @/lib/logger, advance timers to observe
// classification / caching / transition behavior.
// ──────────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const queryMock = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
  flushLogs: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    // Prisma's $queryRaw is a tagged-template fn in real use; the
    // internal call site does `prisma.$queryRaw\`SELECT 1\`` which
    // invokes this mock with (strings, ...values). Return whatever
    // the test configured.
    $queryRaw: queryMock,
  },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  queryMock.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: false });
  const { __resetForTests } = await import("@/lib/db-health");
  __resetForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

// ──────────────────────────────────────────────────────────────────
// Group A — status classification (4 tests)
// ──────────────────────────────────────────────────────────────────

describe("status classification", () => {
  it("healthy when query < 500ms", async () => {
    queryMock.mockResolvedValue([{ ok: 1 }]);
    const { getDbHealth } = await import("@/lib/db-health");
    const result = await getDbHealth();
    expect(result.status).toBe("healthy");
    expect(result.latencyMs).toBeLessThan(500);
  });

  it("degraded when query 500-3000ms", async () => {
    queryMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([{ ok: 1 }]), 1_500);
        }),
    );
    const { getDbHealth } = await import("@/lib/db-health");
    const p = getDbHealth();
    await vi.advanceTimersByTimeAsync(1_500);
    const result = await p;
    expect(result.status).toBe("degraded");
    expect(result.latencyMs).toBeGreaterThanOrEqual(1_500);
    expect(result.latencyMs).toBeLessThan(3_000);
  });

  it("down when query throws", async () => {
    queryMock.mockRejectedValue(new Error("aurora connection refused"));
    const { getDbHealth } = await import("@/lib/db-health");
    const result = await getDbHealth();
    expect(result.status).toBe("down");
    expect(result.error).toContain("aurora connection refused");
  });

  it("down when query exceeds 3s threshold (classified, not hard-timeout)", async () => {
    queryMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([{ ok: 1 }]), 3_500);
        }),
    );
    const { getDbHealth } = await import("@/lib/db-health");
    const p = getDbHealth();
    await vi.advanceTimersByTimeAsync(3_500);
    const result = await p;
    expect(result.status).toBe("down");
    expect(result.latencyMs).toBeGreaterThanOrEqual(3_500);
  });
});

// ──────────────────────────────────────────────────────────────────
// Group B — caching (3 tests)
// ──────────────────────────────────────────────────────────────────

describe("cache", () => {
  it("second call within 30s TTL returns cached result without a new query", async () => {
    queryMock.mockResolvedValue([{ ok: 1 }]);
    const { getDbHealth } = await import("@/lib/db-health");

    await getDbHealth();
    expect(queryMock).toHaveBeenCalledTimes(1);

    // 10s later — well within the 30s TTL.
    await vi.advanceTimersByTimeAsync(10_000);
    await getDbHealth();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("call after 30s TTL runs a fresh probe", async () => {
    queryMock.mockResolvedValue([{ ok: 1 }]);
    const { getDbHealth } = await import("@/lib/db-health");

    await getDbHealth();
    await vi.advanceTimersByTimeAsync(31_000);
    await getDbHealth();

    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("__resetForTests clears the cache", async () => {
    queryMock.mockResolvedValue([{ ok: 1 }]);
    const { getDbHealth, __resetForTests } = await import("@/lib/db-health");

    await getDbHealth();
    expect(queryMock).toHaveBeenCalledTimes(1);

    __resetForTests();
    await getDbHealth();
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});

// ──────────────────────────────────────────────────────────────────
// Group C — assertDbHealthy (3 tests)
// ──────────────────────────────────────────────────────────────────

describe("assertDbHealthy", () => {
  it("healthy: does not throw", async () => {
    const { __setCachedForTests, assertDbHealthy } = await import("@/lib/db-health");
    __setCachedForTests({
      status: "healthy",
      latencyMs: 10,
      checkedAt: new Date(),
    });
    await expect(assertDbHealthy()).resolves.toBeUndefined();
  });

  it("degraded: does not throw (writes allowed in degraded)", async () => {
    const { __setCachedForTests, assertDbHealthy } = await import("@/lib/db-health");
    __setCachedForTests({
      status: "degraded",
      latencyMs: 1_000,
      checkedAt: new Date(),
    });
    await expect(assertDbHealthy()).resolves.toBeUndefined();
  });

  it("down: throws DbUnavailableError with cooldown 30_000", async () => {
    const { __setCachedForTests, assertDbHealthy, DbUnavailableError } =
      await import("@/lib/db-health");
    __setCachedForTests({
      status: "down",
      latencyMs: 5_000,
      checkedAt: new Date(),
    });

    let caught: unknown = null;
    try {
      await assertDbHealthy();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DbUnavailableError);
    expect((caught as InstanceType<typeof DbUnavailableError>).cooldown_ms_remaining).toBe(30_000);
  });
});

// ──────────────────────────────────────────────────────────────────
// Group D — transition logging (2 tests)
// ──────────────────────────────────────────────────────────────────

describe("transition logging", () => {
  it("emits logger.info when status changes (healthy → degraded)", async () => {
    // First probe: healthy (resolves fast).
    queryMock.mockResolvedValueOnce([{ ok: 1 }]);
    const { getDbHealth } = await import("@/lib/db-health");
    await getDbHealth();

    // Snapshot: first probe logs null→healthy transition.
    expect(mockLogger.info).toHaveBeenCalledWith(
      "db_health_status_transition",
      expect.objectContaining({ from: null, to: "healthy" }),
    );
    (mockLogger.info as Mock).mockClear();

    // Second probe past TTL: slow query → degraded.
    queryMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([{ ok: 1 }]), 1_500);
        }),
    );
    await vi.advanceTimersByTimeAsync(31_000);
    const p = getDbHealth();
    await vi.advanceTimersByTimeAsync(1_500);
    await p;

    expect(mockLogger.info).toHaveBeenCalledWith(
      "db_health_status_transition",
      expect.objectContaining({ from: "healthy", to: "degraded" }),
    );
  });

  it("does not log when status stays the same across probes", async () => {
    queryMock.mockResolvedValue([{ ok: 1 }]);
    const { getDbHealth } = await import("@/lib/db-health");

    await getDbHealth(); // null → healthy (logged once)
    (mockLogger.info as Mock).mockClear();

    await vi.advanceTimersByTimeAsync(31_000);
    await getDbHealth(); // healthy → healthy (NOT logged)

    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
