import { GuardDenial, requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/error-response";
import { NextResponse } from "next/server";

const ROUTE = "api/ledger:GET";

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireAuth(ROUTE, "GET");
    const { searchParams } = new URL(request.url);

    // Parse and validate pagination params
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    // LedgerEntry.organizationId is denormalized from Grant (see
    // prisma/schema.prisma) and already covered by
    // @@index([organizationId, createdAt]). The old code loaded every
    // non-archived grant for the org and passed their ids to a
    // `grantId IN (...)` subquery — an unbounded prefetch that forced
    // a scan over every grant for the org on every ledger page load.
    // The org filter alone is strictly more correct and uses the index.
    // (DDIA Ch3 audit.)
    const ledgerWhere = { organizationId };
    const transactionWhere = { organizationId };

    const [ledgerEntries, ledgerTotal, transactions, transactionTotal] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: ledgerWhere,
        // DDIA Ch9 P2 — order by the BIGSERIAL `seq` (deterministic under
        // concurrent same-ms inserts) rather than `createdAt`.
        orderBy: { seq: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.ledgerEntry.count({ where: ledgerWhere }),
      prisma.transaction.findMany({
        where: transactionWhere,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where: transactionWhere }),
    ]);

    return NextResponse.json({
      ledgerEntries,
      transactions,
      ledgerTotal,
      transactionTotal,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof GuardDenial) return error.toErrorResponse();
    return errorResponse({
      kind: "internal",
      message: "Internal server error",
      route: ROUTE,
      method: "GET",
      cause: error,
    });
  }
}
