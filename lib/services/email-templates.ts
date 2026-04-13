// Transactional email templates. Each builder returns { subject, html, text }
// suitable for passing straight into sendEmail() from email-service.ts.
//
// Every HTML body is wrapped with the same shell() so the org branding
// header and compliance footer stay consistent across every email type.
// Plain text bodies are hand-crafted so screen readers and spam filters
// get clean copies.
//
// All user-supplied values flow through escape() before they land in an
// HTML attribute or text node — never concatenate raw input into HTML.

export interface BrandOptions {
  orgName?: string | null;
  orgLogoUrl?: string | null;
}

const PLATFORM_NAME = "BenefitsSafe";

function escape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(innerHtml: string, opts: BrandOptions = {}): string {
  const { orgName, orgLogoUrl } = opts;
  const brandName = escape(orgName || PLATFORM_NAME);
  const logoImg =
    orgName && orgLogoUrl
      ? `<img src="${escape(orgLogoUrl)}" alt="${brandName}" width="36" height="36" style="vertical-align: middle; margin-right: 10px; border-radius: 6px; object-fit: contain; background: #fff;" />`
      : `<span style="display: inline-block; width: 36px; height: 36px; vertical-align: middle; margin-right: 10px; background: #1B2A4A; color: #fff; border-radius: 6px; line-height: 36px; text-align: center; font-weight: 700;">BS</span>`;

  const footerOrgLine = orgName
    ? `Sent by <strong>${brandName}</strong> via ${PLATFORM_NAME}.`
    : `Sent by ${PLATFORM_NAME}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${brandName}</title>
</head>
<body style="margin: 0; padding: 0; background: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f4f5f7; padding: 24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(16,24,40,0.04);">
        <tr><td style="padding: 24px 32px; border-bottom: 1px solid #E5E7EB;">
          ${logoImg}<span style="font-size: 18px; font-weight: 700; color: #111827; vertical-align: middle;">${brandName}</span>
        </td></tr>
        <tr><td style="padding: 32px;">
          ${innerHtml}
        </td></tr>
        <tr><td style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; line-height: 1.5;">
          ${footerOrgLine}<br />
          You received this email because you have an account at ${PLATFORM_NAME}.<br />
          <a href="https://benefitssafe.com" style="color: #6B7280; text-decoration: underline;">benefitssafe.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<div style="text-align: center; margin: 28px 0;">
    <a href="${escape(href)}" style="background: #1B2A4A; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
      ${escape(label)}
    </a>
  </div>`;
}

interface Built {
  subject: string;
  html: string;
  text: string;
}

// ─── 1. INVITE ────────────────────────────────────────────────────────────

export interface InviteEmailParams extends BrandOptions {
  firstName: string;
  inviteUrl: string;
  loginEmail: string;
  expiresDays: number;
  role?: string; // "beneficiary", "vendor", "staff", etc. — optional flavor
}

export function buildInviteEmail(p: InviteEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const subject = p.orgName
    ? `You've been invited to ${org} on BenefitsSafe`
    : `You've been invited to BenefitsSafe`;

  const roleLine = p.role
    ? `<p style="font-size: 15px; color: #4B5563; line-height: 1.6;">You've been invited as a <strong>${escape(p.role.replace(/_/g, " "))}</strong>.</p>`
    : "";

  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">You're invited!</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 12px 0;">Hi ${escape(p.firstName)},</p>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 12px 0;">
      <strong>${escape(org)}</strong> has invited you to BenefitsSafe — the secure platform for managing grant disbursements without risking government benefits.
    </p>
    ${roleLine}
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 12px 0;">
      Your login email: <strong>${escape(p.loginEmail)}</strong>
    </p>
    ${ctaButton(p.inviteUrl, "Set Up My Account")}
    <p style="font-size: 13px; color: #9CA3AF; line-height: 1.5;">
      This invitation link expires in ${escape(p.expiresDays)} days.<br />
      If you didn't expect this invitation, you can safely ignore this email.
    </p>
  `,
    p,
  );

  const text =
    `Hi ${p.firstName},\n\n` +
    `${org} has invited you to BenefitsSafe${p.role ? ` as a ${p.role.replace(/_/g, " ")}` : ""}.\n\n` +
    `Your login email: ${p.loginEmail}\n\n` +
    `Set up your account:\n${p.inviteUrl}\n\n` +
    `This link expires in ${p.expiresDays} days.\n\n` +
    `If you didn't expect this invitation, you can safely ignore this email.`;

  return { subject, html, text };
}

// ─── 2. WELCOME ───────────────────────────────────────────────────────────

export interface WelcomeEmailParams extends BrandOptions {
  firstName: string;
  dashboardUrl: string;
}

export function buildWelcomeEmail(p: WelcomeEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const subject = `Welcome to ${org} on BenefitsSafe`;
  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Welcome, ${escape(p.firstName)}!</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Your account at <strong>${escape(org)}</strong> is ready. You can now access the BenefitsSafe dashboard.</p>
    ${ctaButton(p.dashboardUrl, "Open Dashboard")}
  `,
    p,
  );
  const text = `Welcome, ${p.firstName}!\n\nYour account at ${org} is ready.\n\nOpen your dashboard: ${p.dashboardUrl}`;
  return { subject, html, text };
}

// ─── 3. PASSWORD RESET ────────────────────────────────────────────────────

export interface PasswordResetEmailParams extends BrandOptions {
  firstName: string;
  resetUrl: string;
  expiresMinutes: number;
}

export function buildPasswordResetEmail(p: PasswordResetEmailParams): Built {
  const subject = `Reset your BenefitsSafe password`;
  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Reset your password</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.firstName)},</p>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">We received a request to reset the password for your BenefitsSafe account. Click the button below to set a new password.</p>
    ${ctaButton(p.resetUrl, "Reset Password")}
    <p style="font-size: 13px; color: #9CA3AF; line-height: 1.5;">
      This link expires in ${escape(p.expiresMinutes)} minutes.<br />
      If you didn't request a password reset, you can safely ignore this email — your current password will continue to work.
    </p>
  `,
    p,
  );
  const text =
    `Hi ${p.firstName},\n\n` +
    `We received a request to reset your BenefitsSafe password.\n\n` +
    `Reset link: ${p.resetUrl}\n\n` +
    `This link expires in ${p.expiresMinutes} minutes.\n\n` +
    `If you didn't request this, you can safely ignore this email.`;
  return { subject, html, text };
}

// ─── 4. EXPENSE APPROVED ──────────────────────────────────────────────────

export interface ExpenseDecisionEmailParams extends BrandOptions {
  firstName: string;
  expenseDescription: string;
  amount: string; // pre-formatted currency string
  grantName?: string | null;
  decisionUrl: string;
  notes?: string | null;
}

export function buildExpenseApprovedEmail(p: ExpenseDecisionEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const subject = `${org}: Your expense request was approved`;
  const grantLine = p.grantName
    ? `<p style="font-size: 14px; color: #4B5563;">Grant: <strong>${escape(p.grantName)}</strong></p>`
    : "";
  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">✅ Expense approved</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.firstName)},</p>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">
      ${escape(org)} approved your expense request:
    </p>
    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 15px; color: #14532D; font-weight: 600; margin: 0 0 4px 0;">${escape(p.expenseDescription)}</p>
      <p style="font-size: 18px; color: #14532D; font-weight: 700; margin: 4px 0;">${escape(p.amount)}</p>
      ${grantLine}
    </div>
    ${ctaButton(p.decisionUrl, "View Details")}
  `,
    p,
  );
  const text =
    `Hi ${p.firstName},\n\n` +
    `${org} approved your expense request.\n\n` +
    `Expense: ${p.expenseDescription}\n` +
    `Amount: ${p.amount}\n` +
    (p.grantName ? `Grant: ${p.grantName}\n` : "") +
    `\nView details: ${p.decisionUrl}`;
  return { subject, html, text };
}

// ─── 5. EXPENSE REJECTED ──────────────────────────────────────────────────

export function buildExpenseRejectedEmail(p: ExpenseDecisionEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const subject = `${org}: Your expense request was not approved`;
  const reasonBlock = p.notes
    ? `<p style="font-size: 14px; color: #991B1B; line-height: 1.6; margin: 8px 0 0 0;"><strong>Reason:</strong> ${escape(p.notes)}</p>`
    : "";
  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Expense request not approved</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.firstName)},</p>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">
      ${escape(org)} was unable to approve your expense request at this time.
    </p>
    <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 15px; color: #991B1B; font-weight: 600; margin: 0;">${escape(p.expenseDescription)}</p>
      <p style="font-size: 16px; color: #991B1B; font-weight: 700; margin: 4px 0;">${escape(p.amount)}</p>
      ${reasonBlock}
    </div>
    ${ctaButton(p.decisionUrl, "View Details")}
    <p style="font-size: 13px; color: #9CA3AF; line-height: 1.5;">
      If you have questions, reach out to your case manager.
    </p>
  `,
    p,
  );
  const text =
    `Hi ${p.firstName},\n\n` +
    `${org} was unable to approve your expense request.\n\n` +
    `Expense: ${p.expenseDescription}\n` +
    `Amount: ${p.amount}\n` +
    (p.notes ? `Reason: ${p.notes}\n` : "") +
    `\nView details: ${p.decisionUrl}`;
  return { subject, html, text };
}

// ─── 6. BENEFIT THRESHOLD WARNING ─────────────────────────────────────────

export interface ThresholdEmailParams extends BrandOptions {
  adminFirstName: string;
  beneficiaryName: string;
  program: string; // e.g. "SSI", "Medi-Cal"
  percent: number; // 0–100
  thresholdAmount?: string;
  actionUrl: string;
}

export function buildThresholdWarningEmail(p: ThresholdEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const subject = `⚠️ ${p.beneficiaryName} is approaching their ${p.program} limit`;
  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #92400E; margin: 0 0 16px 0;">⚠️ Benefit threshold warning</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.adminFirstName)},</p>
    <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 15px; color: #92400E; margin: 0 0 4px 0;">
        <strong>${escape(p.beneficiaryName)}</strong> is at <strong>${escape(p.percent)}%</strong> of their <strong>${escape(p.program)}</strong> threshold${p.thresholdAmount ? ` (${escape(p.thresholdAmount)})` : ""}.
      </p>
      <p style="font-size: 14px; color: #92400E; margin: 8px 0 0 0;">
        Additional spending may jeopardize their eligibility. Review the case before approving further expenses.
      </p>
    </div>
    ${ctaButton(p.actionUrl, "Review Case")}
  `,
    p,
  );
  const text =
    `Hi ${p.adminFirstName},\n\n` +
    `${p.beneficiaryName} is at ${p.percent}% of their ${p.program} threshold${p.thresholdAmount ? ` (${p.thresholdAmount})` : ""}.\n\n` +
    `Additional spending may jeopardize their eligibility.\n\n` +
    `Review the case: ${p.actionUrl}\n\n` +
    `Sent by ${org} via BenefitsSafe.`;
  return { subject, html, text };
}

// ─── 7. BENEFIT THRESHOLD CRITICAL ────────────────────────────────────────

export function buildThresholdCriticalEmail(p: ThresholdEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const subject = `🚨 CRITICAL: ${p.beneficiaryName} has exceeded their ${p.program} limit`;
  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #991B1B; margin: 0 0 16px 0;">🚨 Benefit threshold EXCEEDED</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.adminFirstName)},</p>
    <div style="background: #FEF2F2; border: 2px solid #F87171; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 15px; color: #991B1B; margin: 0 0 4px 0;">
        <strong>${escape(p.beneficiaryName)}</strong> is at <strong>${escape(p.percent)}%</strong> of their <strong>${escape(p.program)}</strong> threshold${p.thresholdAmount ? ` (${escape(p.thresholdAmount)})` : ""}.
      </p>
      <p style="font-size: 14px; color: #991B1B; font-weight: 600; margin: 8px 0 0 0;">
        Further spending will put ${escape(p.beneficiaryName)}'s eligibility at risk. Freeze the card and escalate immediately.
      </p>
    </div>
    ${ctaButton(p.actionUrl, "Freeze Card & Review")}
  `,
    p,
  );
  const text =
    `🚨 CRITICAL — ${p.beneficiaryName} has exceeded their ${p.program} limit.\n\n` +
    `Status: ${p.percent}% of threshold${p.thresholdAmount ? ` (${p.thresholdAmount})` : ""}.\n\n` +
    `Freeze the card and escalate: ${p.actionUrl}\n\n` +
    `Sent by ${org} via BenefitsSafe.`;
  return { subject, html, text };
}

// ─── 8. DEVICE LOGIN ──────────────────────────────────────────────────────

export interface DeviceLoginEmailParams extends BrandOptions {
  firstName: string;
  ipAddress: string;
  userAgent: string;
  when: string; // pre-formatted local time string
  accountUrl: string;
}

// ─── 9. COMPLIANCE ALERT ──────────────────────────────────────────────────

export interface ComplianceAlertEmailParams extends BrandOptions {
  adminFirstName: string;
  alertTitle: string;
  alertDescription: string;
  severity: "low" | "medium" | "high" | "critical";
  actionUrl: string;
}

export function buildComplianceAlertEmail(p: ComplianceAlertEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const emoji = p.severity === "critical" ? "🚨" : p.severity === "high" ? "⚠️" : "ℹ️";
  const subject = `${org}: Compliance issue detected — ${p.alertTitle}`;

  const accentBg =
    p.severity === "critical" || p.severity === "high"
      ? "#FEF2F2"
      : p.severity === "medium"
        ? "#FFFBEB"
        : "#F0F9FF";
  const accentBorder =
    p.severity === "critical" || p.severity === "high"
      ? "#FECACA"
      : p.severity === "medium"
        ? "#FDE68A"
        : "#BAE6FD";
  const accentColor =
    p.severity === "critical" || p.severity === "high"
      ? "#991B1B"
      : p.severity === "medium"
        ? "#92400E"
        : "#075985";

  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: ${accentColor}; margin: 0 0 16px 0;">${emoji} ${escape(p.alertTitle)}</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.adminFirstName)},</p>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">
      A compliance issue was detected in your organization that needs your review.
    </p>
    <div style="background: ${accentBg}; border: 1px solid ${accentBorder}; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 14px; color: ${accentColor}; margin: 0; line-height: 1.6;">
        <strong>Severity:</strong> ${escape(p.severity.toUpperCase())}<br />
        ${escape(p.alertDescription)}
      </p>
    </div>
    ${ctaButton(p.actionUrl, "Review Compliance Alert")}
  `,
    p,
  );
  const text =
    `Hi ${p.adminFirstName},\n\n` +
    `${emoji} ${org}: ${p.alertTitle}\n\n` +
    `Severity: ${p.severity.toUpperCase()}\n` +
    `${p.alertDescription}\n\n` +
    `Review: ${p.actionUrl}`;
  return { subject, html, text };
}

// ─── 10. GRANT EXPIRING ───────────────────────────────────────────────────

export interface GrantExpiringEmailParams extends BrandOptions {
  adminFirstName: string;
  grantName: string;
  daysRemaining: number;
  endDate: string;
  grantUrl: string;
}

export function buildGrantExpiringEmail(p: GrantExpiringEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const urgent = p.daysRemaining <= 7;
  const emoji = urgent ? "🚨" : "⏰";
  const subject = `${org}: Grant "${p.grantName}" expires in ${p.daysRemaining} day${p.daysRemaining === 1 ? "" : "s"}`;

  const accentBg = urgent ? "#FEF2F2" : "#FFFBEB";
  const accentBorder = urgent ? "#FECACA" : "#FDE68A";
  const accentColor = urgent ? "#991B1B" : "#92400E";

  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: ${accentColor}; margin: 0 0 16px 0;">${emoji} Grant expiring soon</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.adminFirstName)},</p>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">
      The grant <strong>${escape(p.grantName)}</strong> is ending soon. Review any unspent funds and plan for closeout.
    </p>
    <div style="background: ${accentBg}; border: 1px solid ${accentBorder}; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 16px; color: ${accentColor}; font-weight: 700; margin: 0 0 4px 0;">${escape(p.daysRemaining)} day${p.daysRemaining === 1 ? "" : "s"} remaining</p>
      <p style="font-size: 14px; color: ${accentColor}; margin: 4px 0 0 0;">Ends on ${escape(p.endDate)}</p>
    </div>
    ${ctaButton(p.grantUrl, "Review Grant")}
  `,
    p,
  );
  const text =
    `Hi ${p.adminFirstName},\n\n` +
    `${emoji} Grant "${p.grantName}" expires in ${p.daysRemaining} day${p.daysRemaining === 1 ? "" : "s"} (${p.endDate}).\n\n` +
    `Review any unspent funds and plan for closeout.\n\n` +
    `Review grant: ${p.grantUrl}\n\n` +
    `Sent by ${org} via BenefitsSafe.`;
  return { subject, html, text };
}

// ─── 11. CARD ISSUED ──────────────────────────────────────────────────────

export interface CardIssuedEmailParams extends BrandOptions {
  firstName: string;
  cardLabel: string;
  grantName?: string | null;
  spendingLimit?: string | null;
  dashboardUrl: string;
}

export function buildCardIssuedEmail(p: CardIssuedEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const subject = `${org}: A new virtual card has been issued to you`;

  const grantLine = p.grantName
    ? `<p style="font-size: 14px; color: #14532D; margin: 4px 0 0 0;">From grant: <strong>${escape(p.grantName)}</strong></p>`
    : "";
  const limitLine = p.spendingLimit
    ? `<p style="font-size: 14px; color: #14532D; margin: 4px 0 0 0;">Spending limit: <strong>${escape(p.spendingLimit)}</strong></p>`
    : "";

  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">💳 New virtual card issued</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.firstName)},</p>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">
      ${escape(org)} has issued a new virtual card to you. You can view card details and start using it from your dashboard.
    </p>
    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 16px; color: #14532D; font-weight: 700; margin: 0;">${escape(p.cardLabel)}</p>
      ${grantLine}
      ${limitLine}
    </div>
    ${ctaButton(p.dashboardUrl, "View My Cards")}
    <p style="font-size: 13px; color: #9CA3AF; line-height: 1.5;">
      Your card is ready to use within the spending rules set by ${escape(org)}. Transactions that don't match the rules will be declined.
    </p>
  `,
    p,
  );
  const text =
    `Hi ${p.firstName},\n\n` +
    `${org} has issued a new virtual card to you: ${p.cardLabel}\n` +
    (p.grantName ? `From grant: ${p.grantName}\n` : "") +
    (p.spendingLimit ? `Spending limit: ${p.spendingLimit}\n` : "") +
    `\nView your cards: ${p.dashboardUrl}`;
  return { subject, html, text };
}

// ─── 12. PAYMENT RECEIVED (Vendor) ────────────────────────────────────────

export interface PaymentReceivedEmailParams extends BrandOptions {
  vendorName: string;
  amount: string;
  invoiceRef?: string | null;
  paymentDate: string;
  dashboardUrl: string;
}

export function buildPaymentReceivedEmail(p: PaymentReceivedEmailParams): Built {
  const org = p.orgName || PLATFORM_NAME;
  const subject = `${org}: Payment of ${p.amount} has been processed`;
  const invoiceLine = p.invoiceRef
    ? `<p style="font-size: 14px; color: #14532D; margin: 4px 0 0 0;">Reference: <strong>${escape(p.invoiceRef)}</strong></p>`
    : "";

  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">💰 Payment processed</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.vendorName)},</p>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">
      ${escape(org)} has processed a payment to your account.
    </p>
    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="font-size: 22px; color: #14532D; font-weight: 700; margin: 0;">${escape(p.amount)}</p>
      <p style="font-size: 14px; color: #14532D; margin: 4px 0 0 0;">Processed on ${escape(p.paymentDate)}</p>
      ${invoiceLine}
    </div>
    ${ctaButton(p.dashboardUrl, "View Payment Details")}
  `,
    p,
  );
  const text =
    `Hi ${p.vendorName},\n\n` +
    `${org} has processed a payment to your account.\n\n` +
    `Amount: ${p.amount}\n` +
    `Processed: ${p.paymentDate}\n` +
    (p.invoiceRef ? `Reference: ${p.invoiceRef}\n` : "") +
    `\nView details: ${p.dashboardUrl}`;
  return { subject, html, text };
}

export function buildDeviceLoginEmail(p: DeviceLoginEmailParams): Built {
  const subject = `New login to your BenefitsSafe account`;
  const html = shell(
    `
    <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">New sign-in detected</h1>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">Hi ${escape(p.firstName)},</p>
    <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">We noticed a new sign-in to your BenefitsSafe account:</p>
    <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; color: #4B5563; line-height: 1.8;">
      <div><strong>When:</strong> ${escape(p.when)}</div>
      <div><strong>IP:</strong> ${escape(p.ipAddress)}</div>
      <div><strong>Device:</strong> ${escape(p.userAgent)}</div>
    </div>
    <p style="font-size: 14px; color: #4B5563; line-height: 1.6;">
      If this was you, no action is needed. If you don't recognize this sign-in, change your password immediately and contact your admin.
    </p>
    ${ctaButton(p.accountUrl, "Review Account Activity")}
  `,
    p,
  );
  const text =
    `Hi ${p.firstName},\n\n` +
    `New sign-in detected on your BenefitsSafe account.\n\n` +
    `When: ${p.when}\n` +
    `IP: ${p.ipAddress}\n` +
    `Device: ${p.userAgent}\n\n` +
    `If this wasn't you, change your password and contact your admin:\n${p.accountUrl}`;
  return { subject, html, text };
}
