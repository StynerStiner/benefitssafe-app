import { Redis } from "@upstash/redis";

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
