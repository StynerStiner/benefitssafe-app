import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrismaRead = globalThis as unknown as {
  prismaRead: PrismaClient | undefined;
};

// Reader pool uses the same sizing as the writer — see lib/db.ts for
// rationale. When DATABASE_READ_URL is unset this falls back to the
// writer URL, which means a cold start talks to the writer until the
// reader endpoint is configured in Vercel. (DDIA Ch5 Replication audit.)
const POOL_CONFIG = {
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
} as const;

function createReadClient(): PrismaClient {
  const readUrl = process.env.DATABASE_READ_URL || process.env.DATABASE_URL;
  if (!readUrl) {
    throw new Error("No database URL configured");
  }
  // 30-second query timeout via PG options (prevents runaway queries)
  const url = new URL(readUrl);
  url.searchParams.set("options", "-c statement_timeout=30000");

  const pool = new Pool({
    connectionString: url.toString(),
    ...POOL_CONFIG,
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter }) as PrismaClient;
}

export const prismaRead =
  globalForPrismaRead.prismaRead ?? createReadClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaRead.prismaRead = prismaRead;
}
