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
