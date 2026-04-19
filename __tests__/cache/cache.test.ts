import { describe, it, expect, vi } from "vitest";

// BSRS Ch 8 P2c — lib/cache.ts now imports getDbHealth() at module top
// level for cachedWithStaleness. That transitively loads lib/db.ts,
// which requires DATABASE_URL. Mock the transitive chain so this test
// file (which only exercises cached()) doesn't need a real DB URL.
vi.mock("@/lib/db-health", () => ({
  getDbHealth: vi.fn(() => Promise.resolve({
    status: "healthy",
    latencyMs: 5,
    checkedAt: new Date(),
  })),
}));

import { cached, CACHE_TTL } from "@/lib/cache";

// When Redis is not configured, cached() falls through to the fetcher
// This tests the fallback behavior (in-memory / no-cache path)

describe("Cache wrapper (no-Redis fallback)", () => {
  it("calls fetcher and returns result when no Redis", async () => {
    const result = await cached("test:key:1", CACHE_TTL.SHORT, async () => {
      return { value: 42 };
    });
    expect(result).toEqual({ value: 42 });
  });

  it("calls fetcher every time without Redis (no caching)", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { count: callCount };
    };

    const r1 = await cached("test:key:2", CACHE_TTL.SHORT, fetcher);
    const r2 = await cached("test:key:2", CACHE_TTL.SHORT, fetcher);

    // Without Redis, fetcher is called every time
    expect(r1.count).toBe(1);
    expect(r2.count).toBe(2);
  });

  it("returns fetcher result even if key is complex", async () => {
    const key = "dashboard:org-123:nonprofit_admin:user-456";
    const result = await cached(key, 60, async () => ({
      grants: { total: 5 },
      expenses: { total: 10 },
    }));
    expect(result.grants.total).toBe(5);
    expect(result.expenses.total).toBe(10);
  });

  it("handles fetcher errors by propagating them", async () => {
    await expect(
      cached("test:error", 60, async () => {
        throw new Error("DB connection failed");
      }),
    ).rejects.toThrow("DB connection failed");
  });

  it("CACHE_TTL constants are correct", () => {
    expect(CACHE_TTL.SHORT).toBe(60);
    expect(CACHE_TTL.MEDIUM).toBe(300);
    expect(CACHE_TTL.LONG).toBe(3600);
    expect(CACHE_TTL.COMPLIANCE).toBe(86400);
  });
});
