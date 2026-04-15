import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Connection pool sizing — critical at Vercel serverless scale.
//
// Each warm Lambda holds its own pg.Pool. Default pg.Pool.max is 10 per
// process. At 1K concurrent Lambdas that's up to 10K connections against
// Aurora's ~1000 max_connections default → connection exhaustion under
// load. We cap per-Lambda at 5 so 200 warm Lambdas = 1000 connections,
// which fits behind an RDS Proxy sized for ~1000 concurrent.
//
// connectionTimeoutMillis: 10s — how long pg.Pool waits for a new
// connection before throwing. During an Aurora failover (typically ~30s
// total but most of that is DNS propagation), we want connect attempts
// to fail fast enough that a cron or webhook returns 500 and gets
// retried by QStash/Stripe rather than hanging.
//
// idleTimeoutMillis: 30s — recycle idle sockets every 30 seconds so the
// pool doesn't hold stale connections across Lambda freeze/thaw cycles.
//
// (DDIA Ch5 Replication audit.)
const POOL_CONFIG = {
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
} as const;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  // 30-second query timeout via PG options (prevents runaway queries)
  const url = new URL(connectionString);
  url.searchParams.set("options", "-c statement_timeout=30000");

  const pool = new Pool({
    connectionString: url.toString(),
    ...POOL_CONFIG,
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter }) as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// DDIA Ch8 Distributed Systems audit — transient-error retry wrapper.
//
// The Ch7 Transaction Safety audit introduced `Prisma.TransactionIsolationLevel.Serializable`
// on several financial operations (expense approve, grant PATCH, issue-card,
// process-charge, etc). Under real concurrency Postgres will occasionally
// raise 40001 (serialization_failure) or 40P01 (deadlock_detected), which
// Prisma surfaces as:
//   - code "P2034" (transaction failed due to a write conflict)
//   - or a Postgres error with `meta.code === '40001' / '40P01'`
//
// These are RETRYABLE: the transaction was safely aborted and re-running
// it with the same inputs is correct. Without a retry wrapper, every
// contended approval returns 500 to the user, which is exactly when we
// should be handling contention silently.
//
// Usage:
//   const result = await retryOnSerializationFailure(() =>
//     prisma.$transaction(async (tx) => { ... }, { isolationLevel: Serializable })
//   );
//
// Retries:
//   3 attempts (1 + 2 retries), exponential backoff 50ms → 100ms → 200ms
//   with ±25% jitter. Non-retryable errors propagate immediately.
export async function retryOnSerializationFailure<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 50;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryablePrismaError(err)) throw err;
      if (attempt === maxAttempts) break;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = delay * (0.75 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }
  throw lastErr;
}

function isRetryablePrismaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as {
    code?: string;
    message?: string;
    meta?: { code?: string };
  };
  // Prisma's write-conflict code (raised by Serializable/Snapshot tx aborts).
  if (anyErr.code === "P2034") return true;
  // Raw Postgres SQLSTATEs surfaced through Prisma's meta or message.
  if (anyErr.meta?.code === "40001" || anyErr.meta?.code === "40P01") return true;
  const msg = anyErr.message || "";
  if (msg.includes("could not serialize access")) return true;
  if (msg.includes("deadlock detected")) return true;
  return false;
}
