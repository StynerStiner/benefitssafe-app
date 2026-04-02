// @ts-nocheck
// GET /api/virtual-cards/[id]/statement
// Generate a monthly statement for a virtual card
// Returns JSON data formatted for PDF generation or printing

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string } > },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: cardId } = await params;

    const { role, organizationId } = session.user;

    // Get card with org isolation — scope query by organizationId directly
    const card = await prisma.virtualCard.findFirst({
      where: {
        id: cardId,
        organizationId,
        ...(role === "beneficiary" ? { beneficiaryId: session.user.id } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        beneficiaryId: true,
        last4: true,
        cardType: true,
        status: true,
        expirationMonth: true,
        expirationYear: true,
        spendingCap: true,
        expense: {
          select: {
            id: true,
            amount: true,
            vendor: { select: { name: true } },
            grant: { select: { name: true } },
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 },
      );
    }

    // Get transactions for the card
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        cardId: card.id,
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: {
        id: true,
        amount: true,
        merchantName: true,
        merchantCategory: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate totals
    const approvedTotal = transactions
      .filter((t) => t.status === "approved")
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const declinedTotal = transactions
      .filter((t) => t.status === "declined")
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const disputedTotal = transactions
      .filter((t) => t.status === "disputed")
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    // Get beneficiary info
    const beneficiary = card.beneficiaryId
      ? await prisma.user.findUnique({
          where: { id: card.beneficiaryId },
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        })
      : null;

    // Get organization info
    const organization = await prisma.organization.findUnique({
      where: { id: card.organizationId },
      select: {
        id: true,
        name: true,
      },
    });

    const statement = {
      // Header
      type: "virtual_card_statement",
      generatedAt: new Date().toISOString(),
      period: {
        startDate: startDate.toISOString(),
        endDate: new Date(endDate.getTime() - 1).toISOString(),
        month: startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      },

      // Organization info
      organization: {
        name: organization?.name || "",
        id: organization?.id,
      },

      // Beneficiary info
      beneficiary: beneficiary
        ? {
            name: `${beneficiary.firstName} ${beneficiary.lastName}`,
            email: beneficiary.email,
            phone: beneficiary.phone,
          }
        : null,

      // Card info
      card: {
        id: card.id,
        last4: card.last4,
        type: card.cardType,
        status: card.status,
        expiresAt: `${card.expirationMonth}/${card.expirationYear}`,
        spendingLimit: parseFloat(card.spendingCap.toString()),
      },

      // Related grant/expense
      expense: card.expense
        ? {
            id: card.expense.id,
            amount: parseFloat(card.expense.amount.toString()),
            vendor: card.expense.vendor?.name,
            grant: card.expense.grant?.name,
          }
        : null,

      // Transactions
      transactions: transactions.map((t) => ({
        id: t.id,
        date: t.createdAt.toISOString().split("T")[0],
        merchant: t.merchantName,
        category: t.merchantCategory,
        amount: parseFloat(t.amount.toString()),
        status: t.status,
      })),

      // Summary
      summary: {
        totalTransactions: transactions.length,
        approvedCount: transactions.filter((t) => t.status === "approved").length,
        declinedCount: transactions.filter((t) => t.status === "declined").length,
        disputedCount: transactions.filter((t) => t.status === "disputed").length,
        approvedTotal,
        declinedTotal,
        disputedTotal,
        netAmount: approvedTotal - disputedTotal,
        remainingBalance: parseFloat(card.spendingCap.toString()) - approvedTotal,
      },

      // For PDF generation
      _pdfTemplate: "statement",
      _pdfFilename: `statement-${card.last4}-${year}-${String(month + 1).padStart(2, "0")}.pdf`,
    };

    return NextResponse.json(statement);
  } catch (error) {
    console.error("GET /api/virtual-cards/[id]/statement error:", error);
    return NextResponse.json(
      { error: "Failed to generate statement" },
      { status: 500 },
    );
  }
}
