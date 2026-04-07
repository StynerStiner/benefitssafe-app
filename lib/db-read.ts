import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrismaRead = globalThis as unknown as {
  prismaRead: PrismaClient | undefined;
};

function createReadClient(): PrismaClient {
  const readUrl = process.env.DATABASE_READ_URL
    || process.env.DATABASE_URL;
  if (!readUrl) {
    throw new Error("No database URL configured");
  }
  const adapter = new PrismaPg({ connectionString: readUrl });
  return new PrismaClient({ adapter }) as PrismaClient;
}

export const prismaRead =
  globalForPrismaRead.prismaRead ?? createReadClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrismaRead.prismaRead = prismaRead;
}
