// GET /api/cron/reconcile-orphan-stripe-cards
//
// DDIA Ch8 Distributed Systems audit — orphan Stripe card sweeper.
//
// Ch7 added idempotency keys + compensation to issue-card flows, but
// there is still a narrow window: Stripe returns a successful
// `issuing.cards.create` → Vercel hard-kills the function before we
// open the follow-up $transaction that writes the VirtualCard row.
// The Stripe card exists, no BenefitsSafe row points at it, no
// compensation runs. The card is live at merchants until it expires.
//
// This cron lists recently-created Stripe cards and cancels any that
// have no matching VirtualCard in our DB. It runs hourly, scoped to
// the platform account and every connected account we know about.
//
// Safety rails:
//   - MIN_AGE_MINUTES — don't touch cards younger than this so we
//     don't race a live issue-card that's still in-flight.
//   - MAX_AGE_HOURS — cap the lookback window so we don't repeatedly
//     scan ancient history. If we missed something past this window,
//     the monthly reconciliation cron will catch it as a ledger
//     mismatch and a platform_admin can handle it manually.
//   - Per-call budget so a huge tenant set can't time out the cron.
//
// Schedule: hourly.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { acquireCronLock } from "@/lib/queue";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_NAME = "reconcile-orphan-stripe-cards";

const MIN_AGE_MINUTES = 15;
const MAX_AGE_HOURS = 6;
const LIST_LIMIT = 100;
const MAX_ORGS_PER_RUN = 50;

interface StripeCardLike {
  id: string;
  created: number;
  cardholder?: string | { id?: string } | null;
}

async function sweepAccount(
  stripeAccountId: string | null,
): Promise<{ listed: number; orphaned: number; cancelled: number }> {
  const now = Math.floor(Date.now() / 1000);
  const minCreated = now - MAX_AGE_HOURS * 3600;
  const maxCreated = now - MIN_AGE_MINUTES * 60;

  let listed = 0;
  let orphaned = 0;
  let cancelled = 0;

  try {
    const opts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;
    const cards = await stripe.issuing.cards.list(
      {
        limit: LIST_LIMIT,
        created: { gte: minCreated, lte: maxCreated },
      },
      opts,
    );
    listed = cards.data.length;

    if (listed === 0) return { listed, orphaned, cancelled };

    const stripeCardIds = (cards.data as StripeCardLike[]).map((c) => c.id);
    const known = await prisma.virtualCard.findMany({
      where: { stripeCardId: { in: stripeCardIds } },
      select: { stripeCardId: true },
    });
    const knownSet = new Set(known.map((k) => k.stripeCardId));

    for (const card of cards.data as StripeCardLike[]) {
      if (knownSet.has(card.id)) continue;
      orphaned++;

      try {
        await stripe.issuing.cards.update(
          card.id,
          { status: "canceled" },
          opts,
        );
        cancelled++;
        logger.warn("Cancelled orphan Stripe card", {
          stripeCardId: card.id,
          stripeAccountId: stripeAccountId ?? "platform",
          createdAt: new Date(card.created * 1000).toISOString(),
        });
      } catch (err) {
        logger.error("Failed to cancel orphan Stripe card", {
          stripeCardId: card.id,
          stripeAccountId: stripeAccountId ?? "platform",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logger.error("Stripe cards.list failed", {
      stripeAccountId: stripeAccountId ?? "platform",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { listed, orphaned, cancelled };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const release = await acquireCronLock(CRON_NAME, 600);
  if (!release) {
    return NextResponse.json({ skipped: "already_running" });
  }

  try {
    // Pass A — platform account (covers every platform-mode card across
    // every tenant that hasn't migrated to their own connected account).
    const platformSweep = await sweepAccount(null);

    // Pass B — connected accounts. Only sweep orgs that have connected
    // mode activity recently; a full tenant scan is prohibitive.
    const connectedModeOrgRows = await prisma.virtualCard.findMany({
      where: {
        issuingMode: "connected",
        createdAt: { gte: new Date(Date.now() - MAX_AGE_HOURS * 3600 * 1000) },
      },
      distinct: ["organizationId"],
      select: { organizationId: true },
      take: MAX_ORGS_PER_RUN,
    });
    const orgIds = connectedModeOrgRows.map((r) => r.organizationId);
    const orgs = orgIds.length
      ? await prisma.organization.findMany({
          where: { id: { in: orgIds }, stripeAccountId: { not: null } },
          select: { id: true, stripeAccountId: true },
        })
      : [];

    let connectedListed = 0;
    let connectedOrphaned = 0;
    let connectedCancelled = 0;
    for (const org of orgs) {
      if (!org.stripeAccountId) continue;
      const r = await sweepAccount(org.stripeAccountId);
      connectedListed += r.listed;
      connectedOrphaned += r.orphaned;
      connectedCancelled += r.cancelled;
    }

    return NextResponse.json({
      success: true,
      platform: platformSweep,
      connected: {
        orgsScanned: orgs.length,
        listed: connectedListed,
        orphaned: connectedOrphaned,
        cancelled: connectedCancelled,
      },
    });
  } catch (error) {
    logger.error("Orphan Stripe card sweep failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  } finally {
    await release();
  }
}
