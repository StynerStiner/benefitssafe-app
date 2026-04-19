import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 8 P2c — canonical end-to-end stale-cache test for the
// dashboard route. Verifies the full request → response envelope for
// each of the three server states (healthy / degraded+cache-hit /
// down+cache-miss). Other Tier retrofits will cover their own routes
// in dedicated test files.
// ──────────────────────────────────────────────────────────────────

const mockRedisStore = new Map<string, unknown>();

const mockRedis = {
  get: vi.fn(async <T>(key: string): Promise<T | null> => {
    const v = mockRedisStore.get(key);
    return (v === undefined ? null : v) as T | null;
  }),
  setex: vi.fn(async (key: string, _ttl: number, value: unknown) => {
    mockRedisStore.set(key, value);
    return "OK";
  }),
  del: vi.fn(),
  keys: vi.fn(async () => [] as string[]),
};

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedisCtor {
    constructor() {
      return mockRedis as unknown as MockRedisCtor;
    }
  },
}));

const mockGetDbHealth = vi.fn();
vi.mock("@/lib/db-health", () => ({
  getDbHealth: mockGetDbHealth,
  assertDbHealthy: vi.fn(() => Promise.resolve()),
  DbUnavailableError: class extends Error {
    cooldown_ms_remaining = 30_000;
  },
}));

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({
  auth: mockAuth,
}));

const mockGetDashboardData = vi.fn();
vi.mock("@/lib/data", () => ({
  getDashboardData: mockGetDashboardData,
  invalidateDashboardCache: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const SYSTEM_TIME = new Date("2026-04-18T20:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(SYSTEM_TIME);
  mockRedisStore.clear();
  mockRedis.get.mockClear();
  mockRedis.setex.mockClear();
  mockRedis.get.mockImplementation(async <T>(key: string): Promise<T | null> => {
    const v = mockRedisStore.get(key);
    return (v === undefined ? null : v) as T | null;
  });
  mockRedis.setex.mockImplementation(async (key: string, _ttl: number, value: unknown) => {
    mockRedisStore.set(key, value);
    return "OK";
  });
  mockGetDbHealth.mockReset();
  mockAuth.mockReset();
  mockGetDashboardData.mockReset();
  vi.resetModules();
  process.env.UPSTASH_REDIS_REST_URL = "redis://mock";
  process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

const SESSION = {
  user: { id: "user-1", role: "nonprofit_admin", organizationId: "org-1" },
};

async function callDashboard(): Promise<Response> {
  const { GET } = await import("@/app/api/dashboard/route");
  return GET(new Request("http://localhost/api/dashboard"));
}

describe("GET /api/dashboard — stale-cache envelope (BSRS Ch 8 P2c)", () => {
  it("healthy: returns fresh data without _meta or X-Data-Staleness header", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockGetDbHealth.mockResolvedValue({
      status: "healthy",
      latencyMs: 5,
      checkedAt: SYSTEM_TIME,
    });
    mockGetDashboardData.mockResolvedValue({ totals: { grants: 3 } });

    const res = await callDashboard();
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Data-Staleness")).toBeNull();

    const body = await res.json();
    expect(body).toEqual({ totals: { grants: 3 } });
    expect(body._meta).toBeUndefined();
  });

  it("degraded + cache hit: returns stale data with _meta envelope + X-Data-Staleness header", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockGetDbHealth.mockResolvedValue({
      status: "degraded",
      latencyMs: 1_800,
      checkedAt: SYSTEM_TIME,
    });

    // Pre-populate the cache under the exact key shape the route builds.
    // Key: cache:degraded:${orgId}:dashboard:${role}:${userId}:${hashParams}
    // queryHash for empty params = "default".
    const cacheKey =
      "cache:degraded:org-1:dashboard:nonprofit_admin:user-1:default";
    const cachedAt = "2026-04-18T19:59:30.000Z"; // 30s ago
    mockRedisStore.set(cacheKey, {
      data: { totals: { grants: 2 } },
      cachedAt,
    });

    const res = await callDashboard();
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Data-Staleness")).toBe("30");

    const body = await res.json();
    expect(body.totals).toEqual({ grants: 2 });
    expect(body._meta).toEqual({
      stale: true,
      staleSeconds: 30,
      cachedAt,
    });
    // Fetcher should NOT have run in the stale path.
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });

  it("down + cache miss: returns 503 dependency_unavailable with Retry-After", async () => {
    mockAuth.mockResolvedValue(SESSION);
    mockGetDbHealth.mockResolvedValue({
      status: "down",
      latencyMs: 5_000,
      checkedAt: SYSTEM_TIME,
    });
    // Empty cache — nothing to fall back to.
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await callDashboard();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");

    const body = await res.json();
    expect(body.error).toBe("Aurora is currently unavailable; please retry.");
    expect(body.correlationId).toMatch(/^req_[A-Za-z0-9_-]{8}$/);
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });
});
