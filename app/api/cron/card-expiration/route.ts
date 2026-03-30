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

export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find cards that expired or will expire in next 24 hours
    const expiredCards = await prisma.virtualCard.findMany({
      where: {
        expiresAt: {
          lte: now,
        },
        status: {
          in: ["ACTIVE", "FROZEN"],
        },
      },
      select: {
        id: true,
        stripeCardId: true,
        organizationId: true,
        beneficiaryId: true,
        status: true,
        expiresAt: true,
      },
    });

    const cardsExpiringSoon = await prisma.virtualCard.findMany({
      where: {
        expiresAt: {
          gte: now,
          lte: tomorrow,
        },
        status: {
          in: ["ACTIVE", "FROZEN"],
        },
      },
      select: {
        id: true,
        stripeCardId: true,
        organizationId: true,
        beneficiaryId: true,
        expiresAt: true,
      },
    });

    let successCount = 0;
    let errorCount = 0;

    // EXPIRE old cards
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
              actionUrl: "/virtual-cards",
            },
          });
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to expire card ${card.id}:`, error);
        errorCount++;
      }
    }

    // NOTIFY about cards expiring soon (7 days)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const cardsExpiring7Days = cardsExpiringSoon.filter(
      (card) => card.expiresAt && card.expiresAt <= sevenDaysFromNow,
    );

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

        await prisma.notification.create({
          data: {
            userId: card.beneficiaryId,
            organizationId: card.organizationId,
            type: "card_expiring_soon",
            title: `Your virtual card expires in ${daysUntilExpiry} days`,
            message: `Your virtual card will expire on ${card.expiresAt?.toLocaleDateString()}. Request a new card if you'll need it.`,
            actionUrl: `/virtual-cards/${card.id}`,
          },
        });
      }
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
          cardsNotifiedOfExpiry: cardsExpiring7Days.length,
          executedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      cardsExpired: successCount,
      cardsFailedToExpire: errorCount,
      cardsNotifiedOfExpiry: cardsExpiring7Days.length,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Card expiration cron job failed:", error);

    return NextResponse.json(
      {
        error: "Cron job failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
