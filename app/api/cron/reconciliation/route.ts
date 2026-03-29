// GET /api/cron/reconciliation
// Monthly reconciliation between Stripe transactions and app ledger
// Detects and alerts on discrepancies
// Schedule: Monthly on 1st at 3 AM UTC

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const reconciliationResults = {
      periodStart: lastMonth,
      periodEnd: thisMonth,
      processed: 0,
      discrepancies: [] as Array<{
        type: string;
        description: string;
        impact: string;
      }>,
      summary: {
        stripeTotal: 0,
        ledgerTotal: 0,
        difference: 0,
      },
    };

    // Get all Stripe transactions from last month
    const stripeTransactions = await stripe.issuing.transactions.list({
      limit: 100,
      created: {
        gte: Math.floor(lastMonth.getTime() / 1000),
        lt: Math.floor(thisMonth.getTime() / 1000),
      },
    });

    let stripeTotal = 0;

    // Validate each Stripe transaction is in our ledger
    for (const stripeTx of stripeTransactions.data) {
      const amount = Math.abs(stripeTx.amount) / 100; // Convert from cents
      stripeTotal += amount;

      // Check if this transaction is in our system
      const appTx = await prisma.transaction.findUnique({
        where: { stripeTransactionId: stripeTx.id },
        select: { id: true, amount: true },
      });

      if (!appTx) {
        reconciliationResults.discrepancies.push({
          type: "MISSING_TRANSACTION",
          description: `Stripe transaction ${stripeTx.id} not found in app database`,
          impact: `$${amount.toFixed(2)} unrecorded`,
        });
      } else if (appTx.amount !== amount) {
        reconciliationResults.discrepancies.push({
          type: "AMOUNT_MISMATCH",
          description: `Transaction ${stripeTx.id}: Stripe shows $${amount.toFixed(2)}, app shows $${appTx.amount?.toFixed(2)}`,
          impact: `Discrepancy: $${Math.abs(amount - (appTx.amount || 0)).toFixed(2)}`,
        });
      }

      reconciliationResults.processed++;
    }

    // Get all ledger debits from last month
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        type: "DEBIT",
        createdAt: {
          gte: lastMonth,
          lt: thisMonth,
        },
      },
      select: { id: true, amount: true, reference: true, grantId: true },
    });

    let ledgerTotal = 0;
    for (const entry of ledgerEntries) {
      ledgerTotal += parseFloat(entry.amount.toString());

      // Check if referenced Stripe transaction exists
      if (entry.reference) {
        const stripeTx = await stripe.issuing.transactions.retrieve(entry.reference);
        if (!stripeTx) {
          reconciliationResults.discrepancies.push({
            type: "ORPHANED_LEDGER_ENTRY",
            description: `Ledger entry ${entry.id} references non-existent Stripe transaction`,
            impact: `$${parseFloat(entry.amount.toString()).toFixed(2)} potentially unresolved`,
          });
        }
      }
    }

    reconciliationResults.summary.stripeTotal = stripeTotal;
    reconciliationResults.summary.ledgerTotal = ledgerTotal;
    reconciliationResults.summary.difference = stripeTotal - ledgerTotal;

    // If discrepancies found, notify admins
    if (reconciliationResults.discrepancies.length > 0) {
      // Get all platform admins
      const platformAdmins = await prisma.user.findMany({
        where: { role: "platform_admin" },
        select: { id: true, organizationId: true },
      });

      for (const admin of platformAdmins) {
        if (admin.organizationId) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              organizationId: admin.organizationId,
              type: "reconciliation_discrepancy",
              title: "Monthly reconciliation: Discrepancies found",
              message: `Found ${reconciliationResults.discrepancies.length} discrepancies in ${lastMonth.toLocaleDateString()}. Total difference: $${Math.abs(reconciliationResults.summary.difference).toFixed(2)}. Review details in audit logs.`,
              actionUrl: `/audit-trail?filter=reconciliation&date=${lastMonth.toISOString().split("T")[0]}`,
            },
          });
        }
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "cron_job",
        entityType: "system",
        entityId: "reconciliation",
        newValue: {
          period: `${lastMonth.toISOString()} - ${thisMonth.toISOString()}`,
          stripeTotal: reconciliationResults.summary.stripeTotal,
          ledgerTotal: reconciliationResults.summary.ledgerTotal,
          difference: reconciliationResults.summary.difference,
          discrepancyCount: reconciliationResults.discrepancies.length,
          processed: reconciliationResults.processed,
        },
      },
    });

    return NextResponse.json(reconciliationResults);
  } catch (error) {
    console.error("Monthly reconciliation cron job failed:", error);
    return NextResponse.json(
      {
        error: "Reconciliation job failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
