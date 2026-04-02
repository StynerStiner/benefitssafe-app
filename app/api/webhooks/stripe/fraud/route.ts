// @ts-nocheck
// POST /api/webhooks/stripe/fraud
// Separate webhook handler for fraud-related Stripe events
// Handles radar alerts and fraud signals from Stripe

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

interface FraudEvent {
  type: string;
  data: {
    object: {
      id: string;
      object: string;
      [key: string]: any;
    };
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    // Verify webhook signature — REQUIRED in production
    let event: FraudEvent | null = null;
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      if (process.env.NODE_ENV === "production") {
        console.error("STRIPE_WEBHOOK_SECRET is not set in production — rejecting fraud webhook");
        return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
      }
      // Development only: allow unsigned payloads
      event = JSON.parse(body);
    } else if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    } else {
      try {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET,
        ) as FraudEvent;
      } catch {
        console.error("Stripe fraud webhook signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    if (!event) {
      return NextResponse.json({ received: true });
    }

    // Handle fraud-related events
    switch (event.type) {
      case "radar.early_fraud_warning.created": {
        return handleEarlyFraudWarning(event.data.object);
      }
      case "charge.fraud_detected": {
        return handleChargeFraudDetected(event.data.object);
      }
      case "issuing_authorization.request": {
        // Could also check for fraud signals in authorization requests
        return handleAuthorizationFraudCheck(event.data.object);
      }
      default: {
        return NextResponse.json({ received: true });
      }
    }
  } catch (error) {
    console.error("Stripe fraud webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleEarlyFraudWarning(warning: any) {
  const chargeId = warning.charge;
  const fraudType = warning.fraud_type; // "card_never_received", "unauthorized_transaction"

  try {
    // Find related transaction
    const transaction = await prisma.transaction.findFirst({
      where: {
        // Could map chargeId to transaction if needed
      },
      select: {
        id: true,
        organizationId: true,
        cardId: true,
      },
    });

    if (transaction) {
      // Create alert
      const admins = await prisma.user.findMany({
        where: {
          organizationId: transaction.organizationId,
          role: {
            in: ["nonprofit_admin", "platform_admin"],
          },
        },
        select: { id: true },
      });

      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            organizationId: transaction.organizationId,
            type: "fraud_warning",
            entityId: transaction.cardId,
            title: "Early fraud warning",
            message: `Stripe has flagged a potential fraud risk: ${fraudType}. Charge: ${chargeId}. Please review immediately.`,
            href: `/audit-trail?filter=fraud&chargeId=${chargeId}`,
          },
        });
      }

      // Log to audit trail
      await prisma.auditLog.create({
        data: {
          organizationId: transaction.organizationId,
          action: "fraud_warning",
          entityType: "transaction",
          entityId: transaction.id,
          newValue: {
            fraudType,
            chargeId,
            warningId: warning.id,
          },
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to handle early fraud warning:", error);
    return NextResponse.json({ received: true });
  }
}

async function handleChargeFraudDetected(charge: any) {
  const chargeId = charge.id;
  const fraudDetails = charge.fraud_details;

  try {
    // Alert all platform admins about fraud
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
            type: "charge_fraud_detected",
            entityId: chargeId,
            title: "Fraud detected on charge",
            message: `Fraud has been detected on charge ${chargeId}. Stripe Radar detected: ${fraudDetails?.user_report || "automatic detection"}. Amount: $${(charge.amount / 100).toFixed(2)}. Status: ${charge.status}`,
            href: `/audit-trail?filter=fraud&chargeId=${chargeId}`,
          },
        });
      }
    }

    // Create system audit log
    await prisma.auditLog.create({
      data: {
        action: "fraud_detected",
        entityType: "charge",
        entityId: chargeId,
        newValue: {
          chargeId,
          amount: charge.amount / 100,
          fraudDetails,
          status: charge.status,
          detectedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to handle charge fraud detection:", error);
    return NextResponse.json({ received: true });
  }
}

async function handleAuthorizationFraudCheck(authorization: any) {
  // Additional fraud checks can be done on authorization requests
  // For now, this is a placeholder for future enhancements

  const amount = authorization.pending_request?.amount;
  const merchant = authorization.merchant_data?.name;

  // Could implement velocity checks, unusual patterns, etc.
  // For now, just log it
  await prisma.auditLog.create({
    data: {
      action: "authorization_fraud_check",
      entityType: "authorization",
      entityId: authorization.id,
      newValue: {
        amount: amount / 100,
        merchant,
        timestamp: new Date().toISOString(),
      },
    },
  });

  return NextResponse.json({ received: true });
}
