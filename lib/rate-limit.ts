// Rate limiting with optional Redis backing for distributed environments.
// When Upstash Redis is configured, rate limits are shared across all
// serverless function instances. Otherwise falls back to in-memory Map.

import { redis } from "@/lib/cache";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up old entries every minute (in-memory fallback only)
if (typeof global !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // milliseconds
}

interface RateLimitResult {
  remaining: number;
  resetAt: Date;
  allowed: boolean;
}

// Redis-backed rate limiting for distributed deployments
async function rateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!redis) {
    return rateLimitMemory(identifier, config);
  }

  const key = `ratelimit:${identifier}`;
  const windowSeconds = Math.ceil(config.windowMs / 1000);

  try {
    // Increment counter; if key is new, INCR creates it with value 1
    const count = await redis.incr(key);

    if (count === 1) {
      // First request in this window -- set expiry
      await redis.expire(key, windowSeconds);
    }

    // Get TTL to compute resetAt
    const ttl = await redis.ttl(key);
    const resetAt = new Date(Date.now() + ttl * 1000);
    const remaining = Math.max(0, config.maxRequests - count);
    const allowed = count <= config.maxRequests;

    return { remaining, resetAt, allowed };
  } catch {
    // Redis unavailable -- fall back to in-memory
    return rateLimitMemory(identifier, config);
  }
}

// In-memory rate limiting (single-instance fallback)
function rateLimitMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  let record = rateLimitStore.get(key);

  if (!record || record.resetTime < now) {
    record = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, record);
  }

  record.count++;

  const remaining = Math.max(0, config.maxRequests - record.count);
  const allowed = record.count <= config.maxRequests;

  return {
    remaining,
    resetAt: new Date(record.resetTime),
    allowed,
  };
}

// Synchronous in-memory rate limit (preserves existing API contract)
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  return rateLimitMemory(identifier, config);
}

// Async rate limit that uses Redis when available, in-memory otherwise.
// Prefer this in new code for distributed rate limiting.
export async function rateLimitAsync(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return rateLimitRedis(identifier, config);
}

// Common rate limit configs
export const RATE_LIMIT_CONFIGS = {
  // Card issuance: 10 per minute per user per organization
  cardIssuance: {
    maxRequests: 10,
    windowMs: 60000,
  },
  // Auth endpoints: 5 per minute per IP
  auth: {
    maxRequests: 5,
    windowMs: 60000,
  },
  // API endpoints: 100 per minute per user
  api: {
    maxRequests: 100,
    windowMs: 60000,
  },
  // Webhook: 1000 per minute (Stripe sends many)
  webhook: {
    maxRequests: 1000,
    windowMs: 60000,
  },
  // AI chat: 10 per minute per user (expensive calls)
  aiChat: {
    maxRequests: 10,
    windowMs: 60000,
  },
  // Beneficiary creation: 20 per minute per user
  beneficiaryCreate: {
    maxRequests: 20,
    windowMs: 60000,
  },
  // Grant creation: 10 per minute per user
  grantCreate: {
    maxRequests: 10,
    windowMs: 60000,
  },
  // Expense creation: 30 per minute per user
  expenseCreate: {
    maxRequests: 30,
    windowMs: 60000,
  },
  // Promo code verification: 10 per minute per IP
  promoVerify: {
    maxRequests: 10,
    windowMs: 60000,
  },
  // Login attempts: 5 per 15 minutes per email (account lockout)
  loginAttempt: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  },
  // Fund transfer status polling: 1 per 2 seconds per (user, transferId)
  fundStatusPoll: {
    maxRequests: 1,
    windowMs: 2000,
  },
};
