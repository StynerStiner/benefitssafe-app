import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { classifyExpense } from "@/utils/compliance-rules";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("Compliance deep scan started");

  try {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const recentExpenses = await prisma.expenseRequest.findMany({
      where: { createdAt: { gte: sixHoursAgo } },
      include: {
        grant: { select: { id: true, organizationId: true, benefitFlags: true } },
        category: { select: { name: true } },
      },
    });

    let reclassified = 0;
    const anomalies: Array<{ type: string; expenseId: string; detail: string }> = [];

    for (const expense of recentExpenses) {
      // Re-run classification
      const result = classifyExpense(
        {
          expenseType: expense.expenseType,
          description: expense.description,
          vendorType: expense.vendorName || "",
          amount: Number(expense.amount),
          category: expense.category?.name || "",
          frequency: expense.frequency,
        },
        expense.grant?.benefitFlags as { ssi: boolean; ssdi: boolean; mediCal: boolean; medicaid: boolean; able: boolean } | null,
      );

      if (result.level !== expense.riskClassification) {
        reclassified++;
        logger.warn("Classification changed on re-scan", {
          expenseId: expense.id,
          oldLevel: expense.riskClassification,
          newLevel: result.level,
        });
      }

      // Velocity anomaly: check if beneficiary has >10 expenses in last hour
      if (expense.requestedById) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCount = await prisma.expenseRequest.count({
          where: {
            requestedById: expense.requestedById,
            createdAt: { gte: oneHourAgo },
          },
        });
        if (recentCount > 10) {
          anomalies.push({
            type: "velocity",
            expenseId: expense.id,
            detail: `${recentCount} expenses in 1 hour by user ${expense.requestedById}`,
          });
        }
      }

      // Amount anomaly
      if (Number(expense.amount) > 500) {
        anomalies.push({
          type: "high_amount",
          expenseId: expense.id,
          detail: `$${Number(expense.amount).toFixed(2)} single charge`,
        });
      }
    }

    logger.info("Compliance deep scan completed", {
      scanned: recentExpenses.length,
      reclassified,
      anomalies: anomalies.length,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      scanned: recentExpenses.length,
      reclassified,
      anomalies,
    });
  } catch (error) {
    logger.error("Compliance deep scan failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
