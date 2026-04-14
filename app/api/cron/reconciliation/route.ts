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

    // Hybrid reconciliation. Cards live in two places now:
    //   (a) the BenefitsSafe platform account — all pre-migration cards
    //       plus every tenant whose connected account has not been
    //       granted card_issuing yet.
    //   (b) individual nonprofit Custom connected accounts — tenants
    //       whose connected account has card_issuing active.
    // We walk both:
    //   - One platform-scoped transactions.list covers every platform-
    //     mode card across every tenant in a single call.
    //   - Per-connected-org transactions.list covers tenants that have
    //     graduated to their own connected account.
    // Bound the connected-account loop to orgs with app-side Transaction
    // activity in the period to avoid scanning millions of idle tenants.

    const createdFilter = {
      gte: Math.floor(lastMonth.getTime() / 1000),
      lt: Math.floor(thisMonth.getTime() / 1000),
    };
    const LIST_LIMIT = 100; // Per-call ceiling; pagination is a follow-up.

    const processStripeTxnList = async (stripeTxns: { data: Array<{ id: string; amount: number }> }) => {
      for (const stripeTx of stripeTxns.data) {
        const amount = Math.abs(stripeTx.amount) / 100; // cents → dollars
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
    };

    let stripeTotal = 0;

    // ---- Pass A: platform-scoped list (covers all platform-mode cards)
    try {
      const platformTxns = await stripe.issuing.transactions.list({
        limit: LIST_LIMIT,
        created: createdFilter,
      });
      await processStripeTxnList(platformTxns);
    } catch (err) {
      console.error("[reconciliation] platform transactions.list failed:", err);
    }

    // ---- Pass B: per-connected-org list
    // Only orgs whose Stripe Connect account has card_issuing granted
    // could have connected-mode transactions — everyone else already got
    // scanned in Pass A. We approximate "has connected-mode cards" by
    // joining VirtualCard.issuingMode = 'connected' to the Transaction
    // period activity set.
    const connectedModeOrgRows = await prisma.virtualCard.findMany({
      where: {
        issuingMode: "connected",
        transactions: { some: { createdAt: { gte: lastMonth, lt: thisMonth } } },
      },
      distinct: ["organizationId"],
      select: { organizationId: true },
    });
    const connectedModeOrgIds = connectedModeOrgRows.map((r) => r.organizationId);

    const connectedOrgs = connectedModeOrgIds.length
      ? await prisma.organization.findMany({
          where: {
            id: { in: connectedModeOrgIds },
            stripeAccountId: { not: null },
          },
          select: { id: true, stripeAccountId: true },
        })
      : [];

    for (const org of connectedOrgs) {
      if (!org.stripeAccountId) continue;
      try {
        const connectedTxns = await stripe.issuing.transactions.list(
          { limit: LIST_LIMIT, created: createdFilter },
          { stripeAccount: org.stripeAccountId },
        );
        await processStripeTxnList(connectedTxns);
      } catch (err) {
        console.error(
          `[reconciliation] transactions.list failed for org ${org.id}:`,
          err,
        );
      }
    }

    // Ledger → Stripe direction: for each ledger DEBIT with a reference,
    // confirm the referenced Stripe transaction actually exists on
    // whichever account the underlying card was issued on. Because cards
    // can be either platform-mode or connected-mode, we resolve the
    // routing per-entry via the VirtualCard the Transaction belongs to.
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

    // Pre-fetch all Transaction+VirtualCard rows we need so the loop
    // below doesn't hit the DB twice per entry.
    const ledgerRefs = ledgerEntries
      .map((e) => e.reference)
      .filter((r): r is string => typeof r === "string" && r.length > 0);

    const txnRows = ledgerRefs.length
      ? await prisma.transaction.findMany({
          where: { stripeTransactionId: { in: ledgerRefs } },
          select: {
            stripeTransactionId: true,
            card: {
              select: {
                issuingMode: true,
                organization: { select: { stripeAccountId: true } },
              },
            },
          },
        })
      : [];

    // reference → { issuingMode, stripeAccountId? }
    const refToRouting = new Map<
      string,
      { issuingMode: string | null; stripeAccountId: string | null }
    >();
    for (const row of txnRows) {
      refToRouting.set(row.stripeTransactionId, {
        issuingMode: row.card?.issuingMode ?? null,
        stripeAccountId: row.card?.organization?.stripeAccountId ?? null,
      });
    }

    let ledgerTotal = 0;
    for (const entry of ledgerEntries) {
      ledgerTotal += parseFloat(entry.amount.toString());

      if (!entry.reference) continue;

      // Resolve which Stripe account this reference should resolve on.
      // If the ledger entry references a txn we have no Transaction row
      // for, we can't know the mode — flag as orphan.
      const routing = refToRouting.get(entry.reference);
      if (!routing) {
        reconciliationResults.discrepancies.push({
          type: "ORPHANED_LEDGER_ENTRY",
          description: `Ledger entry ${entry.id} references Stripe transaction ${entry.reference} with no matching app Transaction row`,
          impact: `$${parseFloat(entry.amount.toString()).toFixed(2)} potentially unresolved`,
        });
        continue;
      }

      const retrieveOpts =
        routing.issuingMode === "connected" && routing.stripeAccountId
          ? { stripeAccount: routing.stripeAccountId }
          : {};

      try {
        const stripeTx = await stripe.issuing.transactions.retrieve(
          entry.reference,
          retrieveOpts,
        );
        if (!stripeTx) {
          reconciliationResults.discrepancies.push({
            type: "ORPHANED_LEDGER_ENTRY",
            description: `Ledger entry ${entry.id} references non-existent Stripe transaction`,
            impact: `$${parseFloat(entry.amount.toString()).toFixed(2)} potentially unresolved`,
          });
        }
      } catch (err) {
        console.error(
          `[reconciliation] transactions.retrieve failed for entry ${entry.id}:`,
          err,
        );
        reconciliationResults.discrepancies.push({
          type: "ORPHANED_LEDGER_ENTRY",
          description: `Ledger entry ${entry.id} references Stripe transaction that cannot be retrieved (mode: ${routing.issuingMode ?? "unknown"})`,
          impact: `$${parseFloat(entry.amount.toString()).toFixed(2)} potentially unresolved`,
        });
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
