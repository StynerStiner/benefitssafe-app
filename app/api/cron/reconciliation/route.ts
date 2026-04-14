// @ts-nocheck
// GET /api/cron/reconciliation
// Monthly reconciliation between Stripe transactions and app ledger
// Detects and alerts on discrepancies
// Schedule: Monthly on 1st at 3 AM UTC

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/services/email-service";
import { buildComplianceAlertEmail } from "@/lib/services/email-templates";

const APP_BASE_URL =
  process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";

export async function GET(request: Request) {
  try {
    // Verify cron secret via Authorization header (not query params, to avoid logging)
    // Supports both: ?secret=X (legacy) and Authorization: Bearer X
    const authHeader = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get("secret");
    const secret = authHeader?.replace("Bearer ", "") || querySecret;

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

    // Stripe Issuing transactions now live on each nonprofit's connected
    // account rather than the platform, so we must iterate per-org. Bound
    // the org set to those that actually had app-side Transaction activity
    // in the period — at 1.8M nonprofits, scanning every org monthly
    // would be millions of Stripe API calls with nothing to find.
    const activeOrgRows = await prisma.transaction.findMany({
      where: { createdAt: { gte: lastMonth, lt: thisMonth } },
      distinct: ["organizationId"],
      select: { organizationId: true },
    });
    const activeOrgIds = activeOrgRows.map((r) => r.organizationId);

    const activeOrgs = activeOrgIds.length
      ? await prisma.organization.findMany({
          where: {
            id: { in: activeOrgIds },
            stripeAccountId: { not: null },
          },
          select: { id: true, stripeAccountId: true },
        })
      : [];

    let stripeTotal = 0;

    // NOTE: limit:100 per org is a known cap; per-org pagination is a
    // follow-up once we have a reconciliation checkpoint model. At current
    // scale the 100-tx ceiling matches what the previous platform-scoped
    // call returned anyway — this fix keeps semantics while restoring
    // correctness under the connected-account architecture.
    for (const org of activeOrgs) {
      if (!org.stripeAccountId) continue;
      let stripeTransactions;
      try {
        stripeTransactions = await stripe.issuing.transactions.list(
          {
            limit: 100,
            created: {
              gte: Math.floor(lastMonth.getTime() / 1000),
              lt: Math.floor(thisMonth.getTime() / 1000),
            },
          },
          { stripeAccount: org.stripeAccountId },
        );
      } catch (err) {
        console.error(
          `[reconciliation] transactions.list failed for org ${org.id}:`,
          err,
        );
        continue;
      }

      for (const stripeTx of stripeTransactions.data) {
        const amount = Math.abs(stripeTx.amount) / 100; // Convert from cents
        stripeTotal += amount;

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
    }

    // Get all ledger debits from last month. Pull organizationId so we
    // can route the per-transaction retrieve to the right connected
    // account, and pre-fetch the org→stripeAccount map in one query to
    // avoid an N+1.
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        type: "DEBIT",
        createdAt: {
          gte: lastMonth,
          lt: thisMonth,
        },
      },
      select: {
        id: true,
        amount: true,
        reference: true,
        grantId: true,
        organizationId: true,
      },
    });

    const ledgerOrgIds = Array.from(
      new Set(ledgerEntries.map((e) => e.organizationId)),
    );
    const orgsForLedger = ledgerOrgIds.length
      ? await prisma.organization.findMany({
          where: { id: { in: ledgerOrgIds } },
          select: { id: true, stripeAccountId: true },
        })
      : [];
    const orgStripeAccountMap = new Map(
      orgsForLedger.map((o) => [o.id, o.stripeAccountId]),
    );

    let ledgerTotal = 0;
    for (const entry of ledgerEntries) {
      ledgerTotal += parseFloat(entry.amount.toString());

      // Check if referenced Stripe transaction exists on the org's
      // connected account. Orgs without a Stripe account aren't eligible
      // for this verification path — skip them rather than calling the
      // platform account which no longer holds the transaction.
      if (entry.reference) {
        const stripeAccountId = orgStripeAccountMap.get(entry.organizationId);
        if (!stripeAccountId) continue;
        try {
          const stripeTx = await stripe.issuing.transactions.retrieve(
            entry.reference,
            { stripeAccount: stripeAccountId },
          );
          if (!stripeTx) {
            reconciliationResults.discrepancies.push({
              type: "ORPHANED_LEDGER_ENTRY",
              description: `Ledger entry ${entry.id} references non-existent Stripe transaction`,
              impact: `$${parseFloat(entry.amount.toString()).toFixed(2)} potentially unresolved`,
            });
          }
        } catch (err) {
          // A retrieve failure is itself an orphan signal — the reference
          // on the ledger entry doesn't resolve on the org's account.
          console.error(
            `[reconciliation] transactions.retrieve failed for entry ${entry.id}:`,
            err,
          );
          reconciliationResults.discrepancies.push({
            type: "ORPHANED_LEDGER_ENTRY",
            description: `Ledger entry ${entry.id} references Stripe transaction that cannot be retrieved on org ${entry.organizationId}`,
            impact: `$${parseFloat(entry.amount.toString()).toFixed(2)} potentially unresolved`,
          });
        }
      }
    }

    reconciliationResults.summary.stripeTotal = stripeTotal;
    reconciliationResults.summary.ledgerTotal = ledgerTotal;
    reconciliationResults.summary.difference = stripeTotal - ledgerTotal;

    // If discrepancies found, notify platform admins only.
    //
    // This cron is a platform-wide audit job — it scans ALL Stripe issuing
    // transactions and ALL ledger entries across every nonprofit in one
    // pass, so individual discrepancies cannot be reliably attributed to
    // the org that owns them without additional lookups. Emailing every
    // nonprofit_admin on the platform would leak other orgs' discrepancy
    // details to unrelated tenants. Narrow to BenefitsSafe internal staff
    // (platform_admin). If per-org attribution becomes available, this
    // can fan out again to the affected org's admins.
    if (reconciliationResults.discrepancies.length > 0) {
      const admins = await prisma.user.findMany({
        where: {
          role: "platform_admin",
          isActive: true,
        },
        select: {
          id: true,
          organizationId: true,
          email: true,
          firstName: true,
        },
      });

      const title = "Monthly reconciliation: Discrepancies found";
      const message = `Found ${reconciliationResults.discrepancies.length} discrepancies in ${lastMonth.toLocaleDateString()}. Total difference: $${Math.abs(reconciliationResults.summary.difference).toFixed(2)}. Review details in audit logs.`;
      const href = `/audit-trail?filter=reconciliation&date=${lastMonth.toISOString().split("T")[0]}`;

      for (const admin of admins) {
        if (admin.organizationId) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              organizationId: admin.organizationId,
              type: "reconciliation_discrepancy",
              title,
              message,
              href,
            },
          });

          // Fire-and-forget email alert. Reconciliation errors are high
          // severity — they indicate ledger / Stripe drift.
          if (admin.email) {
            const tmpl = buildComplianceAlertEmail({
              adminFirstName: admin.firstName || "there",
              alertTitle: "Ledger Reconciliation Issue",
              alertDescription: message,
              severity: "high",
              actionUrl: `${APP_BASE_URL}${href}`,
            });
            sendEmail({
              to: admin.email,
              subject: tmpl.subject,
              html: tmpl.html,
              text: tmpl.text,
              userId: admin.id,
              organizationId: admin.organizationId,
              emailType: "compliance_alert",
            }).catch((err) =>
              console.error("[cron-reconciliation] email send failed:", err),
            );
          }
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
      { error: "Reconciliation job failed" },
      { status: 500 },
    );
  }
}
