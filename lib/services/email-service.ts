// Centralized transactional email service.
//
// Single point of entry for every outbound email on the platform. Routes
// should never call Postmark directly — use sendEmail() from here so we get
// consistent dev fallback, audit logging, and error handling.
//
// Transport: Postmark REST API via fetch (matches the existing invite-route
// pattern, no SDK dependency). If POSTMARK_API_TOKEN is missing, the email
// is logged to the console and the function returns { skipped: true } so
// request handlers never crash in dev.

import { prisma } from "@/lib/db";

export type EmailType =
  | "invite"
  | "welcome"
  | "password_reset"
  | "expense_approved"
  | "expense_rejected"
  | "threshold_warning"
  | "threshold_critical"
  | "compliance_alert"
  | "device_login"
  | "grant_expiring"
  | "card_issued"
  | "payment_received"
  | "test";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Nonprofit name for the From display name. When present the sender line
   *  renders as "OrgName via BenefitsSafe". */
  orgName?: string;
  /** If provided together with organizationId, an AuditLog entry is written
   *  on successful send. Both are optional — platform-level emails with no
   *  org context (e.g. pre-signup verification) can omit them. */
  userId?: string;
  organizationId?: string;
  emailType: EmailType;
  /** Optional Reply-To header. */
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  /** true when POSTMARK_API_TOKEN was unset and the email was logged to the
   *  console instead. The caller should still treat this as a non-error. */
  skipped: boolean;
  error?: string;
}

function buildFromLine(orgName?: string): string {
  const fallback = process.env.POSTMARK_FROM_EMAIL || "noreply@benefitssafe.com";
  const displayAddress = fallback.includes("<") ? fallback : `<${fallback}>`;
  if (orgName && orgName.trim()) {
    // Keep the display name short and strip any characters that would break
    // the header. Postmark accepts "Name <addr>" format.
    const cleanName = orgName.replace(/[\r\n<>"]/g, "").trim().slice(0, 80);
    return `${cleanName} via BenefitsSafe ${displayAddress}`;
  }
  return `BenefitsSafe ${displayAddress}`;
}

function logToConsole(args: {
  emailType: EmailType;
  to: string;
  from: string;
  subject: string;
  text: string;
}) {
  // eslint-disable-next-line no-console
  console.log(
    `\n========================================\n` +
      `📧 EMAIL (${args.emailType}) — POSTMARK NOT CONFIGURED\n` +
      `========================================\n` +
      `To:      ${args.to}\n` +
      `From:    ${args.from}\n` +
      `Subject: ${args.subject}\n` +
      `----------------------------------------\n` +
      `${args.text.slice(0, 800)}${args.text.length > 800 ? "\n…(truncated)" : ""}\n` +
      `========================================\n` +
      `(Set POSTMARK_API_TOKEN to send real emails)\n`,
  );
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const {
    to,
    subject,
    html,
    text,
    orgName,
    userId,
    organizationId,
    emailType,
    replyTo,
  } = params;

  const from = buildFromLine(orgName);
  const token = process.env.POSTMARK_API_TOKEN;

  if (!token) {
    logToConsole({ emailType, to, from, subject, text });
    return { sent: false, skipped: true };
  }

  try {
    const body: Record<string, unknown> = {
      From: from,
      To: to,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: "outbound",
    };
    if (replyTo) body.ReplyTo = replyTo;

    // DDIA Ch8 — explicit 5-second timeout. Default fetch() hangs until
    // the underlying TCP timeout (~minutes) when Postmark is unreachable,
    // which can freeze a Vercel function holding other resources.
    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `[email-service] ${emailType} -> ${to} failed: ${res.status} ${errText}`,
      );
      return {
        sent: false,
        skipped: false,
        error: errText || `HTTP ${res.status}`,
      };
    }

    // Fire-and-forget audit log. Don't block the caller or fail the send.
    if (userId && organizationId) {
      prisma.auditLog
        .create({
          data: {
            userId,
            organizationId,
            action: "email_sent",
            entityType: "email",
            entityId: to,
            newValue: { emailType, subject },
          },
        })
        .catch((err) => console.error("[email-service] audit log failed:", err));
    }

    return { sent: true, skipped: false };
  } catch (error) {
    console.error(`[email-service] ${emailType} -> ${to} threw:`, error);
    return {
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
