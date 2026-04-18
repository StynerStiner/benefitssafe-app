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
import { readCheckpoint, writeCheckpoint } from "@/lib/cron-checkpoint";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  stripeCircuit,
  CircuitOpenError,
  CircuitTimeoutError,
  CIRCUIT_OPEN_COOLDOWN_MS,
} from "@/lib/stripe-circuit";
import { errorResponse } from "@/lib/error-response";
import { stripeOptsForCard } from "@/lib/stripe-helpers";
import { acquireCronLock } from "@/lib/queue";
import { sendEmail } from "@/lib/services/email-service";
import { buildComplianceAlertEmail } from "@/lib/services/email-templates";

const ROUTE = "api/cron/card-expiration:GET";

// Each pass has its own checkpoint so they advance independently across
// cron firings even when one pass exhausts its budget before the other.
const CRON_NAME_EXPIRE = "card-expiration-expire";
const CRON_NAME_NOTIFY = "card-expiration-notify";
const CRON_LOCK_NAME = "card-expiration";

const APP_BASE_URL =
  process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";

export async function GET(request: Request) {
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

  // DDIA Ch8 — prevent concurrent runs; each audit log / notification
  // from a duplicate run would be indistinguishable from a real second
  // expiration.
  const release = await acquireCronLock(CRON_LOCK_NAME, 900);
  if (!release) {
    return NextResponse.json({ skipped: "already_running" });
  }

  try {
    // `now` is the Lambda clock; still used for Pass 1 (expire cards whose
    // expiresAt is already past) and for computing daysUntilExpiry in the
    // notification body. Pass 2's window was moved to DB-clock (NOW()) as
    // part of the DDIA Ch11 audit — see the note inside Pass 2 below.
    const now = new Date();

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
    // Resumes from the last cron firing's checkpoint so we don't re-scan
    // already-processed cards on each tick.
    // ------------------------------------------------------------------
    const expireStartCursor = await readCheckpoint(CRON_NAME_EXPIRE);
    let expireCursor: string | undefined = expireStartCursor ?? undefined;
    let processedExpired = 0;
    let expireReachedEnd = false;
    while (processedExpired < MAX_EXPIRE_PER_RUN) {
      const expiredCards: Array<{
        id: string;
        stripeCardId: string;
        organizationId: string;
        beneficiaryId: string | null;
        status: string;
        expiresAt: Date | null;
        issuingMode: string | null;
        organization: { stripeAccountId: string | null; name: string | null } | null;
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
          issuingMode: true,
          organization: { select: { stripeAccountId: true, name: true } },
        },
        take: BATCH_SIZE,
        ...(expireCursor ? { skip: 1, cursor: { id: expireCursor } } : {}),
        orderBy: { id: "asc" },
      });

      if (expiredCards.length === 0) {
        expireReachedEnd = true;
        break;
      }
      processedExpired += expiredCards.length;

    for (const card of expiredCards) {
      try {
        // Cancel the card on whichever account it was issued on.
        // stripeOptsForCard returns {} for platform-mode cards (so the
        // call targets the platform account) and {stripeAccount} for
        // connected-mode cards. Dev-mode mocks and rows with no id
        // are still skipped for the API call.
        if (!card.stripeCardId.startsWith("ic_mock_")) {
          await stripeCircuit.run(
            `${ROUTE}:stripe.issuing.cards.update:expire`,
            { mode: "write" },
            () => stripe.issuing.cards.update(
              card.stripeCardId,
              { status: "canceled" },
              stripeOptsForCard(card, card.organization?.stripeAccountId ?? null),
            ),
          );
        }

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
          const orgName = card.organization?.name || undefined;
          if (beneficiary?.email) {
            const tmpl = buildComplianceAlertEmail({
              adminFirstName: beneficiary.firstName || "there",
              alertTitle: "Your virtual card has expired",
              alertDescription: `Your virtual card ending in ${card.id.slice(-4)} has expired and can no longer be used. Contact your organization if you need a replacement.`,
              severity: "medium",
              actionUrl: `${APP_BASE_URL}/virtual-cards`,
              orgName,
            });
            sendEmail({
              to: beneficiary.email,
              subject: tmpl.subject,
              html: tmpl.html,
              text: tmpl.text,
              orgName,
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
        // Pattern β: bubble circuit errors. Marking N cards as "failed
        // to expire" because Stripe is briefly unreachable would mask
        // the root cause and leave the checkpoint unadvanced anyway.
        // Abort the current tick; next run retries from the same
        // checkpoint cursor. Idempotent — per-card status flip to
        // EXPIRED is a no-op on re-scan.
        if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) throw error;
        console.error(`Failed to expire card ${card.id}:`, error);
        errorCount++;
      }
    }

      expireCursor = expiredCards[expiredCards.length - 1]!.id;
      if (expiredCards.length < BATCH_SIZE) {
        expireReachedEnd = true;
        break;
      }
    }

    await writeCheckpoint(
      CRON_NAME_EXPIRE,
      expireReachedEnd ? null : (expireCursor ?? null),
      processedExpired,
    );

    // ------------------------------------------------------------------
    // Pass 2: NOTIFY cards expiring within 7 days but not yet expired.
    // The window also bounds the candidate set to a small fraction of
    // the global card population (only cards with expiresAt in the
    // upcoming week). Has its own checkpoint independent of pass 1.
    // ------------------------------------------------------------------
    const notifyStartCursor = await readCheckpoint(CRON_NAME_NOTIFY);
    let notifyCursor: string | undefined = notifyStartCursor ?? undefined;
    let processedNotify = 0;
    let cardsNotifiedTotal = 0;
    let notifyReachedEnd = false;
    while (processedNotify < MAX_NOTIFY_PER_RUN) {
      // DDIA Ch11 Stream Processing audit — event-time windowing via DB
      // clock. The previous implementation used `new Date()` on the
      // Lambda (variable `now` above) as both bounds of the 7-day window,
      // which is processing-time semantics: if the cron ran late for any
      // reason (platform outage, bad deploy, pause) a card whose expiry
      // fell inside the lag window would silently miss its "expires
      // soon" notification. Switching to `NOW()` inside a raw query
      // anchors the comparison to the database's monotonic clock — same
      // clock that wrote `expiresAt` in the first place, so there is no
      // cross-clock drift. Dedup remains per-card via the
      // `card_expiring_soon` Notification row check below, so a run that
      // re-scans an already-notified card is a no-op.
      const cardsExpiring7Days: Array<{
        id: string;
        stripeCardId: string;
        organizationId: string;
        beneficiaryId: string | null;
        expiresAt: Date | null;
      }> = notifyCursor
        ? await prisma.$queryRaw`
            SELECT id, "stripeCardId", "organizationId", "beneficiaryId", "expiresAt"
            FROM "VirtualCard"
            WHERE "expiresAt" > NOW()
              AND "expiresAt" <= NOW() + INTERVAL '7 days'
              AND status IN ('ACTIVE', 'FROZEN')
              AND id > ${notifyCursor}
            ORDER BY id ASC
            LIMIT ${BATCH_SIZE}
          `
        : await prisma.$queryRaw`
            SELECT id, "stripeCardId", "organizationId", "beneficiaryId", "expiresAt"
            FROM "VirtualCard"
            WHERE "expiresAt" > NOW()
              AND "expiresAt" <= NOW() + INTERVAL '7 days'
              AND status IN ('ACTIVE', 'FROZEN')
            ORDER BY id ASC
            LIMIT ${BATCH_SIZE}
          `;

      if (cardsExpiring7Days.length === 0) {
        notifyReachedEnd = true;
        break;
      }
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
      if (cardsExpiring7Days.length < BATCH_SIZE) {
        notifyReachedEnd = true;
        break;
      }
    }

    await writeCheckpoint(
      CRON_NAME_NOTIFY,
      notifyReachedEnd ? null : (notifyCursor ?? null),
      processedNotify,
    );

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
    if (error instanceof CircuitOpenError || error instanceof CircuitTimeoutError) {
      // Cron 503: distinct telemetry signal vs generic 500. Checkpoint
      // is NOT advanced on this path — next tick re-scans the same
      // batch once Stripe is healthy. Per-card expiration is idempotent
      // (EXPIRED → EXPIRED is a no-op).
      const retryAfterSeconds =
        error instanceof CircuitOpenError
          ? Math.ceil(error.cooldown_ms_remaining / 1000)
          : Math.ceil(CIRCUIT_OPEN_COOLDOWN_MS / 1000);
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Stripe is currently unavailable; card expiration aborted.",
        route: ROUTE,
        method: "GET",
        retryAfterSeconds,
        cause: error,
      });
    }
    console.error("Card expiration cron job failed:", error);

    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 },
    );
  } finally {
    await release();
  }
}
