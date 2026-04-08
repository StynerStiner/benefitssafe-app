import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = session.user;
    const { searchParams } = new URL(request.url);

    // Parse and validate pagination params
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

    // Get org's grant IDs for scoping
    const orgGrants = await prisma.grant.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true },
    });
    const grantIds = orgGrants.map((g) => g.id);

    const ledgerWhere = { organizationId, grantId: { in: grantIds } };
    const transactionWhere = { organizationId };

    const [ledgerEntries, ledgerTotal, transactions, transactionTotal] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: ledgerWhere,
        orderBy: { createdAt: "desc" },
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
    console.error("GET /api/ledger error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
