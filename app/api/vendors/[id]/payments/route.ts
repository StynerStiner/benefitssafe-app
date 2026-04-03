// GET /api/vendors/[id]/payments — Payment history for a vendor
// Accessible by: org admins (full view) or the vendor themselves (own payments)

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, organizationId, id: userId } = session.user;
    const { id: vendorId } = await params;

    // Verify vendor belongs to this org
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId },
      select: { id: true, name: true, userId: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Vendors can only view their own payments
    if (role === "vendor" && vendor.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Non-vendor, non-admin can't access
    if (role !== "vendor" && role !== "nonprofit_admin" && role !== "nonprofit_staff" && role !== "platform_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50"), 100);
    const offset = Math.max(parseInt(request.nextUrl.searchParams.get("offset") || "0"), 0);

    // Get transactions linked to this vendor's cards
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          organizationId,
          card: { vendorId },
          status: "completed",
        },
        select: {
          id: true,
          amount: true,
          merchantName: true,
          merchantCategory: true,
          status: true,
          createdAt: true,
          grantId: true,
          card: {
            select: {
              beneficiaryId: true,
              cardLabel: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({
        where: {
          organizationId,
          card: { vendorId },
          status: "completed",
        },
      }),
    ]);

    // Also get ledger entries linked to this vendor's expenses
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        expense: {
          vendorId,
          grant: { organizationId },
        },
      },
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        createdAt: true,
        expense: {
          select: {
            description: true,
            grant: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get beneficiary names (first name only for privacy)
    const beneficiaryIds = transactions
      .map((t) => t.card.beneficiaryId)
      .filter((id): id is string => id !== null);

    const beneficiaries = beneficiaryIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: beneficiaryIds } },
          select: { id: true, firstName: true },
        })
      : [];

    const benMap = new Map(beneficiaries.map((b) => [b.id, b.firstName]));

    // Get grant names
    const grantIds = transactions
      .map((t) => t.grantId)
      .filter((id): id is string => id !== null);

    const grants = grantIds.length > 0
      ? await prisma.grant.findMany({
          where: { id: { in: grantIds } },
          select: { id: true, name: true },
        })
      : [];

    const grantMap = new Map(grants.map((g) => [g.id, g.name]));

    // Calculate summary
    const totalReceived = transactions.reduce(
      (sum, t) => sum + parseFloat(String(t.amount)),
      0
    );
    const lastPaymentDate = transactions.length > 0 ? transactions[0].createdAt : null;

    const payments = transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      merchantName: t.merchantName,
      status: t.status,
      grantName: t.grantId ? grantMap.get(t.grantId) || null : null,
      beneficiaryFirstName: t.card.beneficiaryId ? benMap.get(t.card.beneficiaryId) || null : null,
      cardLabel: t.card.cardLabel,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({
      vendorName: vendor.name,
      summary: {
        totalReceived,
        paymentCount: total,
        lastPaymentDate,
      },
      payments,
      ledgerEntries,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /api/vendors/[id]/payments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
