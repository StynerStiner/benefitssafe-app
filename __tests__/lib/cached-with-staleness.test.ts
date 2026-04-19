import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ──────────────────────────────────────────────────────────────────
// BSRS Ch 8 P2c — cachedWithStaleness + hashParams tests.
//
// Mocking strategy mirrors __tests__/lib/db-health.test.ts:
//   - vi.mock() the @upstash/redis module so cache.ts gets a fake client.
//   - vi.mock() @/lib/db-health so getDbHealth() is deterministic.
//   - Fake timers with shouldAdvanceTime:false + setSystemTime for
//     deterministic cachedAt math.
//   - vi.resetModules + dynamic import so each test imports a fresh
//     copy of cache.ts (the Redis singleton is module-level).
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
  // Class-style mock so `new Redis(...)` in cache.ts returns our stub.
  Redis: class MockRedisCtor {
    constructor() {
      return mockRedis as unknown as MockRedisCtor;
    }
  },
}));

const mockGetDbHealth = vi.fn();

vi.mock("@/lib/db-health", () => ({
  getDbHealth: mockGetDbHealth,
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
  vi.resetModules();
  process.env.UPSTASH_REDIS_REST_URL = "redis://mock";
  process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

const KEY = "cache:degraded:org1:test:default";

// ──────────────────────────────────────────────────────────────────
// Group A — healthy mode (3 tests)
// ──────────────────────────────────────────────────────────────────

describe("cachedWithStaleness — healthy mode", () => {
  it("A1: cache miss → fresh, no cache write (lazy-populate)", async () => {
    mockGetDbHealth.mockResolvedValue({
      status: "healthy",
      latencyMs: 5,
      checkedAt: SYSTEM_TIME,
    });
    const { cachedWithStaleness } = await import("@/lib/cache");
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher: async () => ({ value: "fresh" }),
    });
    expect(result.kind).toBe("fresh");
    if (result.kind === "fresh") expect(result.data).toEqual({ value: "fresh" });
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it("A2: cache hit exists but is ignored in healthy mode", async () => {
    mockRedisStore.set(KEY, {
      data: { value: "cached" },
      cachedAt: "2026-04-18T19:59:00.000Z",
    });
    mockGetDbHealth.mockResolvedValue({
      status: "healthy",
      latencyMs: 5,
      checkedAt: SYSTEM_TIME,
    });
    const { cachedWithStaleness } = await import("@/lib/cache");
    const fetcher = vi.fn(async () => ({ value: "fresh" }));
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher,
    });
    expect(result.kind).toBe("fresh");
    if (result.kind === "fresh") expect(result.data).toEqual({ value: "fresh" });
    expect(fetcher).toHaveBeenCalled();
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it("A3: fetcher throws in healthy mode → propagates (no 503)", async () => {
    mockGetDbHealth.mockResolvedValue({
      status: "healthy",
      latencyMs: 5,
      checkedAt: SYSTEM_TIME,
    });
    const { cachedWithStaleness } = await import("@/lib/cache");
    await expect(
      cachedWithStaleness({
        key: KEY,
        ttlSeconds: 60,
        maxStaleSeconds: 600,
        fetcher: async () => {
          throw new Error("db_boom");
        },
      }),
    ).rejects.toThrow("db_boom");
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// Group B — degraded mode, cache hit (4 tests)
// ──────────────────────────────────────────────────────────────────

describe("cachedWithStaleness — degraded, cache hit", () => {
  beforeEach(() => {
    mockGetDbHealth.mockResolvedValue({
      status: "degraded",
      latencyMs: 1_800,
      checkedAt: SYSTEM_TIME,
    });
  });

  it("B1: fresh hit within maxStale → stale result with computed staleSeconds", async () => {
    const cachedAt = "2026-04-18T19:59:50.000Z"; // 10s ago
    mockRedisStore.set(KEY, { data: { value: "cached" }, cachedAt });
    const { cachedWithStaleness } = await import("@/lib/cache");
    const fetcher = vi.fn();
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher,
    });
    expect(result.kind).toBe("stale");
    if (result.kind === "stale") {
      expect(result.data).toEqual({ value: "cached" });
      expect(result.staleSeconds).toBe(10);
      expect(result.cachedAt).toBe(cachedAt);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it("B2: boundary hit (exactly maxStale seconds old) → stale", async () => {
    const cachedAt = "2026-04-18T19:50:00.000Z"; // 600s ago, maxStale 600
    mockRedisStore.set(KEY, { data: { value: "cached" }, cachedAt });
    const { cachedWithStaleness } = await import("@/lib/cache");
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher: async () => ({ value: "fresh" }),
    });
    expect(result.kind).toBe("stale");
  });

  it("B3: expired hit (> maxStale) → fetcher called, fresh + write-through", async () => {
    const cachedAt = "2026-04-18T19:40:00.000Z"; // 1200s ago
    mockRedisStore.set(KEY, { data: { value: "old" }, cachedAt });
    const { cachedWithStaleness } = await import("@/lib/cache");
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher: async () => ({ value: "fresh" }),
    });
    expect(result.kind).toBe("fresh");
    if (result.kind === "fresh") expect(result.data).toEqual({ value: "fresh" });
    expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    // Verify the cache entry now carries the fresh data + new cachedAt.
    const stored = mockRedisStore.get(KEY) as { data: unknown; cachedAt: string };
    expect(stored.data).toEqual({ value: "fresh" });
    expect(stored.cachedAt).toBe(SYSTEM_TIME.toISOString());
  });

  it("B4: malformed cache entry → treated as miss, fetcher called", async () => {
    mockRedisStore.set(KEY, { garbage: true });
    const { cachedWithStaleness } = await import("@/lib/cache");
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher: async () => ({ value: "fresh" }),
    });
    expect(result.kind).toBe("fresh");
    expect(mockRedis.setex).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// Group C — degraded mode, cache miss (3 tests)
// ──────────────────────────────────────────────────────────────────

describe("cachedWithStaleness — degraded, cache miss", () => {
  beforeEach(() => {
    mockGetDbHealth.mockResolvedValue({
      status: "degraded",
      latencyMs: 1_800,
      checkedAt: SYSTEM_TIME,
    });
  });

  it("C1: fetcher succeeds within timeout → fresh + cache populated", async () => {
    const { cachedWithStaleness } = await import("@/lib/cache");
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher: async () => ({ value: "fresh" }),
    });
    expect(result.kind).toBe("fresh");
    expect(mockRedis.setex).toHaveBeenCalledTimes(1);
  });

  it("C2: fetcher times out → unavailable (degraded_timeout), no cache write", async () => {
    const { cachedWithStaleness } = await import("@/lib/cache");
    const p = cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher: () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ value: "slow" }), 10_000),
        ),
      degradedFetcherTimeoutMs: 3_000,
    });
    await vi.advanceTimersByTimeAsync(3_100);
    const result = await p;
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toBe("degraded_timeout");
    }
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it("C3: fetcher throws → unavailable, no cache write", async () => {
    const { cachedWithStaleness } = await import("@/lib/cache");
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher: async () => {
        throw new Error("aurora_boom");
      },
    });
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toBe("degraded_timeout");
    }
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// Group D — down mode (2 tests)
// ──────────────────────────────────────────────────────────────────

describe("cachedWithStaleness — down mode", () => {
  beforeEach(() => {
    mockGetDbHealth.mockResolvedValue({
      status: "down",
      latencyMs: 5_000,
      checkedAt: SYSTEM_TIME,
    });
  });

  it("D1: cache hit within maxStale → stale, fetcher never called", async () => {
    const cachedAt = "2026-04-18T19:59:30.000Z"; // 30s ago
    mockRedisStore.set(KEY, { data: { value: "cached" }, cachedAt });
    const { cachedWithStaleness } = await import("@/lib/cache");
    const fetcher = vi.fn();
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher,
    });
    expect(result.kind).toBe("stale");
    if (result.kind === "stale") expect(result.staleSeconds).toBe(30);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("D2: cache miss → unavailable (down_no_cache), fetcher never called", async () => {
    const { cachedWithStaleness } = await import("@/lib/cache");
    const fetcher = vi.fn();
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher,
    });
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toBe("down_no_cache");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────
// Group E — Redis errors / graceful degradation (2 tests)
// ──────────────────────────────────────────────────────────────────

describe("cachedWithStaleness — Redis errors (graceful)", () => {
  beforeEach(() => {
    mockGetDbHealth.mockResolvedValue({
      status: "degraded",
      latencyMs: 1_800,
      checkedAt: SYSTEM_TIME,
    });
  });

  it("E2: Redis read throws → treated as cache miss, fetcher called", async () => {
    mockRedis.get.mockRejectedValueOnce(new Error("redis_down"));
    const { cachedWithStaleness } = await import("@/lib/cache");
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher: async () => ({ value: "fresh" }),
    });
    expect(result.kind).toBe("fresh");
  });

  it("E3: Redis write throws → data still returned fresh (silent failure)", async () => {
    mockRedis.setex.mockRejectedValueOnce(new Error("redis_write_fail"));
    const { cachedWithStaleness } = await import("@/lib/cache");
    const result = await cachedWithStaleness({
      key: KEY,
      ttlSeconds: 60,
      maxStaleSeconds: 600,
      fetcher: async () => ({ value: "fresh" }),
    });
    expect(result.kind).toBe("fresh");
    if (result.kind === "fresh") expect(result.data).toEqual({ value: "fresh" });
  });
});

// ──────────────────────────────────────────────────────────────────
// Group G — hashParams (3 tests)
// ──────────────────────────────────────────────────────────────────

describe("hashParams", () => {
  it("G1: empty query string → 'default'", async () => {
    const { hashParams } = await import("@/lib/cache");
    expect(hashParams({ url: "http://localhost/api/test" })).toBe("default");
  });

  it("G2: same params in different order hash identically", async () => {
    const { hashParams } = await import("@/lib/cache");
    const a = hashParams({ url: "http://localhost/api/test?limit=25&offset=0" });
    const b = hashParams({ url: "http://localhost/api/test?offset=0&limit=25" });
    expect(a).toBe(b);
    expect(a).not.toBe("default");
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it("G3: different values hash differently", async () => {
    const { hashParams } = await import("@/lib/cache");
    const a = hashParams({ url: "http://localhost/api/test?limit=25" });
    const b = hashParams({ url: "http://localhost/api/test?limit=50" });
    expect(a).not.toBe(b);
  });
});
