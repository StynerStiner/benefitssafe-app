import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { getDbHealth } from "./db-health";

// Gracefully handle missing Redis config (falls back to no-cache)
let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Export for use in rate-limit.ts
export { redis };

// Generic cache helper
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!redis) return fetcher();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis down, fall through to fetcher
  }

  const data = await fetcher();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch {
    // Redis down, data still returned
  }

  return data;
}

// Invalidate cache for a single key
export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(pattern);
  } catch {
    // Redis down, silently fail
  }
}

// Invalidate multiple keys by prefix
export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Redis down, silently fail
  }
}

// Cache keys constants
export const CACHE_KEYS = {
  orgSettings: (orgId: string) => `org:settings:${orgId}`,
  orgGrants: (orgId: string) => `org:grants:${orgId}`,
  orgVendors: (orgId: string) => `org:vendors:${orgId}`,
  orgBeneficiaries: (orgId: string) => `org:beneficiaries:${orgId}`,
  orgPolicies: (orgId: string) => `org:policies:${orgId}`,
  complianceRules: () => `compliance:rules`,
  userSession: (userId: string) => `user:session:${userId}`,
  platformStats: () => `platform:stats`,
} as const;

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  COMPLIANCE: 86400, // 24 hours (rules don't change often)
} as const;

// ────────────────────────────────────────────────────────────────────
// BSRS Ch 8 P2c — stale-cache reads during Aurora degraded mode
// ────────────────────────────────────────────────────────────────────
//
// `cachedWithStaleness` is the read-path counterpart to P2b's write-path
// assertDbHealthy() gate. When getDbHealth() reports "healthy" the helper
// delegates straight to the fetcher (no cache writes — lazy-populate per
// operator policy). When the DB is "degraded" or "down" it falls back to
// a per-route Redis cache and returns a structured staleness envelope
// that routes surface via `_meta` + `X-Data-Staleness`.
//
// Serialization note: @upstash/redis auto-serializes values passed to
// setex() and auto-parses values returned by get(). This helper relies
// on that built-in behavior; it does NOT manually JSON.stringify like the
// older `cached()` above. Do not "fix" that — the two helpers have
// different contracts by design.

export type StaleCacheResult<T> =
  | { kind: "fresh"; data: T }
  | { kind: "stale"; data: T; staleSeconds: number; cachedAt: string }
  | { kind: "unavailable"; reason: "down_no_cache" | "degraded_timeout" };

interface StaleCacheEntry<T> {
  data: T;
  cachedAt: string; // ISO 8601
}

/**
 * Tiered TTLs for degraded-mode caches. `ttlSeconds` is reserved for a
 * future write-through mode; in today's lazy-populate mode only
 * `maxStaleSeconds` is consulted. Tuning lives here, not in routes.
 */
export const STALE_CACHE_TTL = {
  DASHBOARD: { ttlSeconds: 60, maxStaleSeconds: 600 },
  LIST: { ttlSeconds: 120, maxStaleSeconds: 600 },
  NOTIFICATIONS: { ttlSeconds: 30, maxStaleSeconds: 120 },
  ORG_SETTINGS: { ttlSeconds: 600, maxStaleSeconds: 3_600 },
  PLATFORM_STATS: { ttlSeconds: 300, maxStaleSeconds: 1_800 },
  FINANCIAL_LIST: { ttlSeconds: 60, maxStaleSeconds: 120 },
  REPORTS: { ttlSeconds: 300, maxStaleSeconds: 900 },
} as const;

export const STALE_CACHE_KEY_PREFIX = "cache:degraded";
const DEFAULT_DEGRADED_FETCHER_TIMEOUT_MS = 3_000;

/**
 * Short, deterministic hash of a request's query params. Used as the
 * tail segment of a stale-cache key so paginated or filtered variants
 * don't collide. Params are sorted so `?limit=25&offset=0` and
 * `?offset=0&limit=25` hash identically.
 */
export function hashParams(request: { url: string }): string {
  const url = new URL(request.url);
  const sorted = [...url.searchParams.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (sorted.length === 0) return "default";
  const normalized = sorted.map(([k, v]) => `${k}=${v}`).join("&");
  return createHash("sha1").update(normalized).digest("hex").slice(0, 12);
}

async function readStaleCacheEntry<T>(
  key: string,
): Promise<StaleCacheEntry<T> | null> {
  if (!redis) return null;
  try {
    const hit = await redis.get<StaleCacheEntry<T>>(key);
    if (!hit || typeof hit !== "object" || !("data" in hit) || !("cachedAt" in hit)) {
      return null;
    }
    return hit as StaleCacheEntry<T>;
  } catch {
    return null; // Redis down — treat as cache miss
  }
}

async function writeStaleCacheEntry<T>(
  key: string,
  data: T,
  ttlSeconds: number,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, {
      data,
      cachedAt: new Date().toISOString(),
    });
  } catch {
    // Silent — writer availability is not load-bearing for correctness
  }
}

/**
 * Fetch data with Aurora-aware staleness fallback.
 *
 *   healthy  → fetcher() only, return {kind: "fresh"}. No cache write.
 *   degraded → cache read first; fresh-enough hit → {kind: "stale"};
 *              miss or too-old → fetcher with timeout, populate cache on
 *              success (write-through only on degraded miss);
 *              timeout → {kind: "unavailable", reason: "degraded_timeout"}.
 *   down     → cache read only; hit → {kind: "stale"}; miss →
 *              {kind: "unavailable", reason: "down_no_cache"}. Fetcher
 *              never called.
 *
 * Auth MUST be verified before calling this helper. The helper is
 * intentionally unaware of session/org context — callers compose the
 * `key` from their own `organizationId` + route segment + `hashParams(request)`.
 */
export async function cachedWithStaleness<T>(opts: {
  key: string;
  ttlSeconds: number;
  maxStaleSeconds: number;
  fetcher: () => Promise<T>;
  degradedFetcherTimeoutMs?: number;
}): Promise<StaleCacheResult<T>> {
  const { key, ttlSeconds, maxStaleSeconds, fetcher } = opts;
  const degradedTimeoutMs =
    opts.degradedFetcherTimeoutMs ?? DEFAULT_DEGRADED_FETCHER_TIMEOUT_MS;

  const health = await getDbHealth();

  if (health.status === "healthy") {
    const data = await fetcher();
    return { kind: "fresh", data };
  }

  const cached = await readStaleCacheEntry<T>(key);
  if (cached) {
    const staleSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(cached.cachedAt).getTime()) / 1000),
    );
    if (staleSeconds <= maxStaleSeconds) {
      return {
        kind: "stale",
        data: cached.data,
        staleSeconds,
        cachedAt: cached.cachedAt,
      };
    }
    // Cache entry too old — fall through to fetcher (degraded) or
    // unavailable (down).
  }

  if (health.status === "down") {
    return { kind: "unavailable", reason: "down_no_cache" };
  }

  // Degraded + cache miss (or expired). Try fetcher with hard timeout.
  // Outer-promise pattern mirrors lib/stripe-circuit.ts:165 to avoid the
  // microtask-ordering edge case with Promise.race + vitest timers.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const data = await new Promise<T>((resolve, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("degraded_fetcher_timeout")),
        degradedTimeoutMs,
      );
      fetcher().then(resolve, reject);
    });
    await writeStaleCacheEntry(key, data, ttlSeconds);
    return { kind: "fresh", data };
  } catch {
    return { kind: "unavailable", reason: "degraded_timeout" };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}
