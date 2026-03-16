import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId } = session.user;

    // Get org's grant IDs for scoping
    const orgGrants = await prisma.grant.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true },
    });
    const grantIds = orgGrants.map((g) => g.id);

    const [ledgerEntries, transactions] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: { grantId: { in: grantIds } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.transaction.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return NextResponse.json({ ledgerEntries, transactions });
  } catch (error) {
    console.error("GET /api/ledger error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
