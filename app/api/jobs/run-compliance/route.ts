// @ts-nocheck
// POST /api/jobs/run-compliance — Deep compliance scan for one org
// Called by QStash queue from the compliance cron job.

import { prisma } from "@/lib/db";
import { classifyExpense } from "@/utils/compliance-rules";
import { verifyJobAuth } from "@/lib/queue";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!verifyJobAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data } = await request.json();
    const { orgId } = data;

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    // Fetch recent expenses for this org
    const expenses = await prisma.expenseRequest.findMany({
      where: {
        grant: { organizationId: orgId },
        createdAt: { gte: sixHoursAgo },
      },
      include: {
        grant: { select: { benefitFlags: true } },
        vendor: { select: { type: true } },
        category: { select: { name: true } },
      },
    });

    let reclassified = 0;
    let anomalies = 0;

    for (const expense of expenses) {
      const benefitFlags = expense.grant?.benefitFlags as {
        ssi: boolean; ssdi: boolean; mediCal: boolean; medicaid: boolean; able: boolean;
      } | null;

      const result = classifyExpense(
        {
          expenseType: expense.expenseType,
          description: expense.description,
          vendorType: expense.vendor?.type ?? "ONE_TIME_VENDOR",
          amount: Number(expense.amount),
          category: expense.category?.name ?? "uncategorized",
          frequency: expense.frequency,
        },
        benefitFlags,
      );

      // Check if classification changed
      if (result.level !== expense.riskClassification) {
        await prisma.expenseRequest.update({
          where: { id: expense.id },
          data: {
            riskClassification: result.level,
            riskNotes: `[Reclassified] ${result.reason}`,
          },
        });
        reclassified++;
      }

      // Velocity check: >10 expenses by same user in 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const velocityCount = await prisma.expenseRequest.count({
        where: {
          requestedById: expense.requestedById,
          createdAt: { gte: oneHourAgo },
        },
      });

      if (velocityCount > 10) {
        anomalies++;
      }

      // Amount anomaly: >$500
      if (Number(expense.amount) > 500) {
        anomalies++;
      }
    }

    return NextResponse.json({
      success: true,
      orgId,
      scanned: expenses.length,
      reclassified,
      anomalies,
    });
  } catch (error) {
    console.error("[run-compliance] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
