// @ts-nocheck
// GET /api/cron/card-expiration
// Automated cron job to freeze/cancel expired virtual cards
// Schedule: Daily via external cron service (EasyCron, Vercel Cron, etc.)
//
// How to set up:
// 1. Add CRON_SECRET to .env.local (any random string)
// 2. Set up external cron service to call:
//    GET https://yourdomain.com/api/cron/card-expiration?secret=YOUR_CRON_SECRET
// 3. Schedule for daily at 2 AM UTC

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
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Cursor-paginated scans + per-run budget. The previous implementation
    // loaded EVERY expired/expiring card across all 1.8M nonprofits into
    // one Lambda — at scale that's hundreds of millions of rows and
    // OOMs the cron. We now process at most BATCH_SIZE * MAX_BATCHES
    // cards per run; any remaining cards are picked up next run.
    //
    // The candidate set is also naturally bounded by status filter
    // (only ACTIVE/FROZEN cards) so steady-state runs only see cards
    // that crossed the expiry boundary since the last cron tick.
    const BATCH_SIZE = 200;
    const MAX_EXPIRE_PER_RUN = 2000;
    const MAX_NOTIFY_PER_RUN = 2000;

    let successCount = 0;
    let errorCount = 0;

    // ------------------------------------------------------------------
    // Pass 1: EXPIRE cards whose expiresAt has passed.
    // ------------------------------------------------------------------
    let expireCursor: string | undefined = undefined;
    let processedExpired = 0;
    while (processedExpired < MAX_EXPIRE_PER_RUN) {
      const expiredCards: Array<{
        id: string;
        stripeCardId: string;
        organizationId: string;
        beneficiaryId: string | null;
        status: string;
        expiresAt: Date | null;
      }> = await prisma.virtualCard.findMany({
        where: {
          expiresAt: { lte: now },
          status: { in: ["ACTIVE", "FROZEN"] },
        },
        select: {
          id: true,
          stripeCardId: true,
          organizationId: true,
          beneficiaryId: true,
          status: true,
          expiresAt: true,
        },
        take: BATCH_SIZE,
        ...(expireCursor ? { skip: 1, cursor: { id: expireCursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (expiredCards.length === 0) break;
      processedExpired += expiredCards.length;

    for (const card of expiredCards) {
      try {
        // Update Stripe card status to lost (effectively disables it)
        await stripe.issuing.cards.update(card.stripeCardId, {
          status: "canceled",
        });

        // Update database
        await prisma.virtualCard.update({
          where: { id: card.id },
          data: {
            status: "EXPIRED",
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: "system",
            organizationId: card.organizationId,
            action: "update",
            entityType: "virtualCard",
            entityId: card.id,
            newValue: {
              status: "EXPIRED",
              reason: "Card expiration date passed",
              expiredAt: new Date().toISOString(),
            },
          },
        });

        // Create notification for beneficiary
        if (card.beneficiaryId) {
          await prisma.notification.create({
            data: {
              userId: card.beneficiaryId,
              organizationId: card.organizationId,
              type: "card_expired",
              title: "Your virtual card has expired",
              message: `Your virtual card ending in ${card.id.slice(-4)} has expired and can no longer be used.`,
              href: "/virtual-cards",
            },
          });

          // Fire-and-forget email to the beneficiary. We reuse the
          // compliance-alert shell for now since there is no dedicated
          // card_expired template; the tone still reads clearly.
          const beneficiary = await prisma.user.findUnique({
            where: { id: card.beneficiaryId },
            select: { email: true, firstName: true },
          });
          const org = await prisma.organization.findUnique({
            where: { id: card.organizationId },
            select: { name: true },
          });
          if (beneficiary?.email) {
            const tmpl = buildComplianceAlertEmail({
              adminFirstName: beneficiary.firstName || "there",
              alertTitle: "Your virtual card has expired",
              alertDescription: `Your virtual card ending in ${card.id.slice(-4)} has expired and can no longer be used. Contact your organization if you need a replacement.`,
              severity: "medium",
              actionUrl: `${APP_BASE_URL}/virtual-cards`,
              orgName: org?.name || undefined,
            });
            sendEmail({
              to: beneficiary.email,
              subject: tmpl.subject,
              html: tmpl.html,
              text: tmpl.text,
              orgName: org?.name || undefined,
              userId: card.beneficiaryId,
              organizationId: card.organizationId,
              emailType: "compliance_alert",
            }).catch((err) =>
              console.error("[card-expiration email] expired failed:", err),
            );
          }
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to expire card ${card.id}:`, error);
        errorCount++;
      }
    }

      expireCursor = expiredCards[expiredCards.length - 1]!.id;
      if (expiredCards.length < BATCH_SIZE) break;
    }

    // ------------------------------------------------------------------
    // Pass 2: NOTIFY cards expiring within 7 days but not yet expired.
    // The window also bounds the candidate set to a small fraction of
    // the global card population (only cards with expiresAt in the
    // upcoming week).
    // ------------------------------------------------------------------
    let notifyCursor: string | undefined = undefined;
    let processedNotify = 0;
    let cardsNotifiedTotal = 0;
    while (processedNotify < MAX_NOTIFY_PER_RUN) {
      const cardsExpiring7Days: Array<{
        id: string;
        stripeCardId: string;
        organizationId: string;
        beneficiaryId: string | null;
        expiresAt: Date | null;
      }> = await prisma.virtualCard.findMany({
        where: {
          expiresAt: { gt: now, lte: sevenDaysFromNow },
          status: { in: ["ACTIVE", "FROZEN"] },
        },
        select: {
          id: true,
          stripeCardId: true,
          organizationId: true,
          beneficiaryId: true,
          expiresAt: true,
        },
        take: BATCH_SIZE,
        ...(notifyCursor ? { skip: 1, cursor: { id: notifyCursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (cardsExpiring7Days.length === 0) break;
      processedNotify += cardsExpiring7Days.length;

    for (const card of cardsExpiring7Days) {
      // Check if we already sent a notification (once per card)
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: card.beneficiaryId || undefined,
          type: "card_expiring_soon",
          entityId: card.id,
        },
        select: { id: true },
      });

      if (!existingNotification && card.beneficiaryId) {
        const daysUntilExpiry = Math.ceil(
          (card.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        const expiringTitle = `Your virtual card expires in ${daysUntilExpiry} days`;
        const expiringMessage = `Your virtual card will expire on ${card.expiresAt?.toLocaleDateString()}. Request a new card if you'll need it.`;

        await prisma.notification.create({
          data: {
            userId: card.beneficiaryId,
            organizationId: card.organizationId,
            type: "card_expiring_soon",
            title: expiringTitle,
            message: expiringMessage,
            href: `/virtual-cards/${card.id}`,
          },
        });

        // Fire-and-forget reminder email to the beneficiary.
        const beneficiary = await prisma.user.findUnique({
          where: { id: card.beneficiaryId },
          select: { email: true, firstName: true },
        });
        const org = await prisma.organization.findUnique({
          where: { id: card.organizationId },
          select: { name: true },
        });
        if (beneficiary?.email) {
          const tmpl = buildComplianceAlertEmail({
            adminFirstName: beneficiary.firstName || "there",
            alertTitle: expiringTitle,
            alertDescription: expiringMessage,
            // Low severity for 7-day reminder; the card is still usable.
            severity: "low",
            actionUrl: `${APP_BASE_URL}/virtual-cards/${card.id}`,
            orgName: org?.name || undefined,
          });
          sendEmail({
            to: beneficiary.email,
            subject: tmpl.subject,
            html: tmpl.html,
            text: tmpl.text,
            orgName: org?.name || undefined,
            userId: card.beneficiaryId,
            organizationId: card.organizationId,
            emailType: "compliance_alert",
          }).catch((err) =>
            console.error("[card-expiration email] expiring failed:", err),
          );
        }
        cardsNotifiedTotal++;
      }
    }

      notifyCursor = cardsExpiring7Days[cardsExpiring7Days.length - 1]!.id;
      if (cardsExpiring7Days.length < BATCH_SIZE) break;
    }

    // Create job completion audit log
    await prisma.auditLog.create({
      data: {
        action: "cron_job",
        entityType: "system",
        entityId: "card-expiration",
        newValue: {
          cardsExpired: successCount,
          errors: errorCount,
          cardsNotifiedOfExpiry: cardsNotifiedTotal,
          expireBudgetExhausted: processedExpired >= MAX_EXPIRE_PER_RUN,
          notifyBudgetExhausted: processedNotify >= MAX_NOTIFY_PER_RUN,
          executedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      cardsExpired: successCount,
      cardsFailedToExpire: errorCount,
      cardsNotifiedOfExpiry: cardsNotifiedTotal,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Card expiration cron job failed:", error);

    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 },
    );
  }
}
