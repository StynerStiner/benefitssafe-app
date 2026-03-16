// GET /api/search?q=john — Global search across all entities (ORG-SCOPED)
// Searches: beneficiaries, grants, expenses, vendors, team members

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { organizationId, role } = session.user;
    const q = request.nextUrl.searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchFilter = { contains: q, mode: "insensitive" as const };
    const limit = 5; // Per category

    // Run all searches in parallel
    const [beneficiaries, grants, expenses, vendors, team] = await Promise.all([
      // Beneficiaries
      role !== "vendor"
        ? prisma.user.findMany({
            where: {
              organizationId,
              role: "beneficiary",
              isActive: true,
              OR: [
                { firstName: searchFilter },
                { lastName: searchFilter },
                { email: searchFilter },
                { phone: { contains: q } },
              ],
            },
            select: { id: true, firstName: true, lastName: true, email: true },
            take: limit,
          })
        : [],

      // Grants
      prisma.grant.findMany({
        where: {
          organizationId,
          archivedAt: null,
          OR: [
            { name: searchFilter },
            { grantIssuerName: searchFilter },
            { description: searchFilter },
          ],
        },
        select: { id: true, name: true, grantIssuerName: true, status: true },
        take: limit,
      }),

      // Expenses
      prisma.expenseRequest.findMany({
        where: {
          grant: { organizationId },
          archivedAt: null,
          OR: [
            { description: searchFilter },
            { vendorName: searchFilter },
            { expenseType: searchFilter },
          ],
        },
        select: {
          id: true,
          description: true,
          amount: true,
          status: true,
          vendorName: true,
        },
        take: limit,
      }),

      // Vendors
      prisma.vendor.findMany({
        where: {
          organizationId,
          archivedAt: null,
          OR: [
            { name: searchFilter },
            { email: searchFilter },
          ],
        },
        select: { id: true, name: true, email: true, type: true, status: true },
        take: limit,
      }),

      // Team members (non-beneficiary users)
      role === "nonprofit_admin" || role === "platform_admin"
        ? prisma.user.findMany({
            where: {
              organizationId,
              role: { not: "beneficiary" },
              isActive: true,
              OR: [
                { firstName: searchFilter },
                { lastName: searchFilter },
                { email: searchFilter },
              ],
            },
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
            take: limit,
          })
        : [],
    ]);

    return NextResponse.json({
      results: {
        beneficiaries: beneficiaries.map((b) => ({
          id: b.id,
          title: `${b.firstName} ${b.lastName}`,
          subtitle: b.email,
          type: "beneficiary" as const,
          href: `/beneficiaries/${b.id}`,
        })),
        grants: grants.map((g) => ({
          id: g.id,
          title: g.name,
          subtitle: g.grantIssuerName,
          type: "grant" as const,
          href: `/grants/${g.id}`,
          badge: g.status,
        })),
        expenses: expenses.map((e) => ({
          id: e.id,
          title: e.description.substring(0, 60),
          subtitle: e.vendorName || `$${e.amount}`,
          type: "expense" as const,
          href: `/expenses`,
          badge: e.status,
        })),
        vendors: vendors.map((v) => ({
          id: v.id,
          title: v.name,
          subtitle: v.email || v.type,
          type: "vendor" as const,
          href: `/vendors/${v.id}`,
          badge: v.status,
        })),
        team: team.map((t) => ({
          id: t.id,
          title: `${t.firstName} ${t.lastName}`,
          subtitle: t.email,
          type: "team" as const,
          href: `/users`,
          badge: t.role,
        })),
      },
      query: q,
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
