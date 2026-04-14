// @ts-nocheck
// POST /api/webhooks/stripe/fraud
// Separate webhook handler for fraud-related Stripe events
// Handles radar alerts and fraud signals from Stripe

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/services/email-service";
import { buildComplianceAlertEmail } from "@/lib/services/email-templates";

const APP_BASE_URL =
  process.env.NEXTAUTH_URL || "https://app.benefitssafe.com";

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
    // Attempt to map the Stripe charge to one of our Transactions.
    // We don't have a direct charge_id → transaction mapping, so the
    // best-effort lookup matches `stripeTransactionId === chargeId` —
    // harmless if it doesn't match, and correct when it does.
    //
    // IMPORTANT: never fall back to an empty `where` clause here. A
    // previous version of this handler did `findFirst({ where: {} })`
    // which returned an arbitrary Transaction row and fanned fraud alerts
    // to an unrelated org's admins.
    const transaction = chargeId
      ? await prisma.transaction.findFirst({
          where: { stripeTransactionId: chargeId },
          select: {
            id: true,
            organizationId: true,
            cardId: true,
          },
        })
      : null;

    if (transaction) {
      // Happy path: charge resolved to a specific org. Fan out to that
      // org's admins + compliance_officer, plus every platform_admin.
      await fanOutFraudAlert({
        resolvedOrgId: transaction.organizationId,
        resolvedEntityId: transaction.cardId,
        title: "Early fraud warning",
        message: `Stripe has flagged a potential fraud risk: ${fraudType}. Charge: ${chargeId}. Please review immediately.`,
        alertTitle: `Early fraud warning: ${fraudType}`,
        alertDescription: `Stripe has flagged a potential fraud risk on charge ${chargeId}. Fraud type: ${fraudType}. Please review the transaction immediately and verify card controls are active.`,
        chargeId,
        notificationType: "fraud_warning",
      });

      // Audit log scoped to the resolved org.
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
    } else {
      // Fallback: charge could not be attributed to any of our Transactions.
      // Notify platform_admin ONLY with a note about the unresolvable org —
      // never guess at an org to attribute this to.
      await notifyPlatformAdminsOnly({
        title: "Early fraud warning (unresolved org)",
        message: `Stripe early fraud warning on charge ${chargeId} (${fraudType}) — could not map to a BenefitsSafe transaction. Manual triage required.`,
        chargeId,
        notificationType: "fraud_warning",
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

  const alertTitle = "Fraud detected on charge";
  const alertMessage = `Fraud has been detected on charge ${chargeId}. Stripe Radar detected: ${fraudDetails?.user_report || "automatic detection"}. Amount: $${(charge.amount / 100).toFixed(2)}. Status: ${charge.status}`;

  try {
    // Resolve chargeId → Transaction → organizationId FIRST.
    //
    // Previously this handler queried `role: "platform_admin" | "compliance_officer"`
    // globally with no org filter, then wrote notifications scoped to each
    // recipient's own org — leaking charge details across every tenant
    // that had a compliance_officer. At 1.8M nonprofits that would mean
    // hundreds of thousands of cross-tenant notifications per fraud event.
    //
    // The correct model: platform_admin is cross-org by design (BenefitsSafe
    // internal staff), so they get notified globally. Everyone else is
    // strictly scoped to the org that actually owns the charge.
    const transaction = chargeId
      ? await prisma.transaction.findFirst({
          where: { stripeTransactionId: chargeId },
          select: { id: true, organizationId: true, cardId: true },
        })
      : null;

    if (transaction) {
      await fanOutFraudAlert({
        resolvedOrgId: transaction.organizationId,
        resolvedEntityId: chargeId,
        title: alertTitle,
        message: alertMessage,
        alertTitle,
        alertDescription: alertMessage,
        chargeId,
        notificationType: "charge_fraud_detected",
      });
    } else {
      // Charge can't be attributed — notify platform_admin only.
      await notifyPlatformAdminsOnly({
        title: `${alertTitle} (unresolved org)`,
        message: `${alertMessage} — could not map this charge to a BenefitsSafe transaction. Manual triage required.`,
        chargeId,
        notificationType: "charge_fraud_detected",
      });
    }

    // Create system audit log (no organizationId: this is a platform-level
    // audit record of the fraud event itself).
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
          resolvedOrgId: transaction?.organizationId || null,
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

// ============================================================================
// Shared fraud-alert fan-out helpers
// ============================================================================

interface FraudFanoutParams {
  resolvedOrgId: string;
  resolvedEntityId: string | null;
  title: string;
  message: string;
  alertTitle: string;
  alertDescription: string;
  chargeId: string;
  notificationType: string;
}

/**
 * Fan out a fraud alert for a charge that HAS been resolved to a specific
 * organization. Writes notifications + emails to:
 *  - every nonprofit_admin + compliance_officer in the resolved org
 *  - every platform_admin globally (BenefitsSafe internal staff are trusted
 *    with cross-org visibility by design)
 *
 * Never fans out to admins of orgs other than the resolved one.
 */
async function fanOutFraudAlert(params: FraudFanoutParams): Promise<void> {
  // Org-scoped recipients: nonprofit_admin + compliance_officer in the charge's org.
  // Bounded to 100 per org to keep the webhook handler under Stripe's 30s
  // delivery budget — at scale, only the first ~100 admins get the email
  // alert; the rest still see it in-app via the dashboard notification feed.
  const orgRecipients = await prisma.user.findMany({
    where: {
      organizationId: params.resolvedOrgId,
      role: {
        in: ["nonprofit_admin", "compliance_officer"],
      },
      isActive: true,
    },
    select: { id: true, organizationId: true, email: true, firstName: true },
    take: 100,
  });

  // Platform admins (global, cross-org by design).
  // Bounded to 50 — at 1.8M nonprofits with 10K+ BenefitsSafe internal
  // staff, a per-fraud-event scan of every platform_admin would lock the
  // User table and exceed the webhook timeout. The first 50 receive the
  // email; an oncall rotation covers the rest.
  const platformRecipients = await prisma.user.findMany({
    where: {
      role: "platform_admin",
      isActive: true,
    },
    select: { id: true, organizationId: true, email: true, firstName: true },
    take: 50,
  });

  const org = await prisma.organization.findUnique({
    where: { id: params.resolvedOrgId },
    select: { name: true },
  });
  const orgName = org?.name || undefined;

  const href = `/audit-trail?filter=fraud&chargeId=${params.chargeId}`;

  // Org recipients: notification scoped to the charge's org.
  for (const admin of orgRecipients) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        organizationId: params.resolvedOrgId,
        type: params.notificationType,
        entityId: params.resolvedEntityId,
        title: params.title,
        message: params.message,
        href,
      },
    });
    sendFraudEmail(admin, orgName, params, href);
  }

  // Platform admins: notification scoped to their own home org (they're
  // internal staff; this is intentional because platform_admin is trusted
  // to see cross-org data). But the message body explicitly mentions the
  // resolved org so they know which tenant to triage.
  const crossOrgMessage = `${params.message} (org: ${orgName || params.resolvedOrgId})`;
  for (const admin of platformRecipients) {
    if (!admin.organizationId) continue;
    await prisma.notification.create({
      data: {
        userId: admin.id,
        organizationId: admin.organizationId,
        type: params.notificationType,
        entityId: params.resolvedEntityId,
        title: params.title,
        message: crossOrgMessage,
        href,
      },
    });
    sendFraudEmail(
      admin,
      orgName,
      {
        ...params,
        alertDescription: `${params.alertDescription}\n\nOrg: ${orgName || params.resolvedOrgId}`,
      },
      href,
    );
  }
}

/**
 * Fallback path for fraud alerts where the charge could NOT be resolved
 * to a specific organization. Only platform_admin gets notified — never
 * fan out to random orgs' admins or compliance officers in this case.
 */
async function notifyPlatformAdminsOnly(params: {
  title: string;
  message: string;
  chargeId: string;
  notificationType: string;
}): Promise<void> {
  // Bounded to 50 — see fanOutFraudAlert() comment above.
  const platformRecipients = await prisma.user.findMany({
    where: { role: "platform_admin", isActive: true },
    select: { id: true, organizationId: true, email: true, firstName: true },
    take: 50,
  });

  const href = `/audit-trail?filter=fraud&chargeId=${params.chargeId}`;

  for (const admin of platformRecipients) {
    if (!admin.organizationId) continue;
    await prisma.notification.create({
      data: {
        userId: admin.id,
        organizationId: admin.organizationId,
        type: params.notificationType,
        entityId: params.chargeId,
        title: params.title,
        message: params.message,
        href,
      },
    });

    if (admin.email) {
      const tmpl = buildComplianceAlertEmail({
        adminFirstName: admin.firstName || "there",
        alertTitle: params.title,
        alertDescription: params.message,
        severity: "critical",
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
        console.error("[fraud-webhook] platform email send failed:", err),
      );
    }
  }
}

/** Fire-and-forget email helper used by fanOutFraudAlert. */
function sendFraudEmail(
  admin: { id: string; organizationId: string | null; email: string | null; firstName: string | null },
  orgName: string | undefined,
  params: FraudFanoutParams,
  href: string,
): void {
  if (!admin.email || !admin.organizationId) return;
  const tmpl = buildComplianceAlertEmail({
    adminFirstName: admin.firstName || "there",
    alertTitle: params.alertTitle,
    alertDescription: params.alertDescription,
    severity: "critical",
    actionUrl: `${APP_BASE_URL}${href}`,
    orgName,
  });
  sendEmail({
    to: admin.email,
    subject: tmpl.subject,
    html: tmpl.html,
    text: tmpl.text,
    orgName,
    userId: admin.id,
    organizationId: admin.organizationId,
    emailType: "compliance_alert",
  }).catch((err) =>
    console.error("[fraud-webhook] email send failed:", err),
  );
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
