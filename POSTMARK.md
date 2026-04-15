# BenefitsSafe — Postmark Configuration

Last verified: April 14, 2026

## Status: ✅ APPROVED

- **Approved on:** April 14, 2026
- **Confirmed by:** Ignacio (Postmark)
- **What changed:** The account is out of the pending/review state. Emails now deliver to **any recipient address**, not just addresses on verified domains.

Before approval, only emails to verified-domain addresses were sent; all other recipients silently failed the domain check. That restriction is lifted.

## Delivery rules that must be maintained

Postmark enforces these account-level thresholds. Crossing any of them will cause the account to be reviewed, throttled, or suspended.

| Metric | Limit | Why |
|---|---|---|
| **Bounce rate** | < **10%** | Too many hard bounces indicates stale or fabricated recipient lists. |
| **Spam complaint rate** | < **0.1%** | Recipients marking messages as spam. Postmark is strict here — 1 in 1000 is the ceiling. |
| **Bulk messages** | Must use the **Broadcast Message Stream**, NOT the Transactional stream | Transactional and Broadcast are separate streams with separate reputations. Sending newsletters or marketing blasts through the Transactional stream will burn the account's reputation and violate Postmark's ToS. |

## How this shows up in the code

### Transactional emails (always use Transactional stream)

All per-user automated emails go through the Transactional stream — these are system-triggered, 1:1, expected by the recipient:

- Password reset (`lib/services/email-templates.ts` → `buildPasswordResetEmail`)
- Email verification
- Invite / accept-invite
- Card issued notifications (`buildCardIssuedEmail`)
- Compliance alerts (`buildComplianceAlertEmail`)
- Expense approval / rejection
- Card expired / expiring-soon reminders (from `cron/card-expiration`)
- Reconciliation discrepancy alerts (from `cron/reconciliation`)

Transactional stream is the default in `lib/services/email-service.ts`.

### Broadcast emails (must use Broadcast Message Stream)

**Not yet built.** If and when BenefitsSafe adds:

- Platform-wide newsletters
- Product announcements to all users
- Marketing nurture sequences
- Digest / weekly-summary emails sent in batches to many users at once

…those MUST be routed through a Broadcast Message Stream in Postmark, configured as a separate stream with its own Message Stream ID. Add a new `POSTMARK_BROADCAST_STREAM_ID` env var and pass it as `MessageStream` in the API call. Do NOT repurpose the transactional stream for these.

## Bounce and complaint monitoring

Postmark exposes metrics in the dashboard at **https://account.postmarkapp.com**. Check weekly:

1. **Servers → (BenefitsSafe server) → Messages → Bounces** — watch the rolling bounce rate. If it creeps above 5%, investigate which sender or which recipient segment is driving it before it hits 10%.
2. **Servers → (BenefitsSafe server) → Messages → Spam complaints** — any uptick here is urgent. Spam complaints compound fast on Postmark's reputation model.
3. **Set up webhook:** Postmark can POST bounce + spam-complaint events to an app webhook. We do not currently have this wired. When we cross a meaningful user count, add `/api/webhooks/postmark` that suppresses the recipient's address in our DB on bounce/complaint so we stop retrying known-bad addresses.

## What could push us over the limits

The biggest risk vectors for BenefitsSafe specifically:

1. **Sending to beneficiaries with unverified or fake email addresses.** Nonprofits onboarding beneficiaries may enter placeholder emails (`noemail@example.com`, `test@test.com`, `.`, etc.). These hard-bounce on first send. Mitigation: validate email format at onboarding and flag addresses with known-bad patterns before we send the first card-issued email.
2. **Sending to old addresses from an imported legacy list.** If a nonprofit imports a CSV of past grant recipients, a non-trivial percentage will be stale. Mitigation: require email verification (click-through link) before any outbound email is sent to newly-imported beneficiaries.
3. **Compliance alert blasts to all nonprofit admins on the platform.** The reconciliation cron emails every `platform_admin` on high-severity discrepancies; at scale this is fine for now (there are few platform admins), but if we ever broaden this to `nonprofit_admin` across all tenants, it would shift into broadcast territory and belongs on the Broadcast stream.

## Recovery if we get flagged

If the account is throttled or paused by Postmark:

1. Log into the Postmark dashboard and read the notification — they'll tell you which metric crossed and which server.
2. Identify the specific sender / template / recipient segment that caused it (Postmark's bounce/complaint reports show the exact message ids).
3. Suppress the problematic segment in our DB (add an `email_suppressed` flag on `User` if we don't have one yet).
4. Contact Postmark support — they're responsive and typically unlock quickly if you explain the cause and the fix.
5. Do NOT just re-send the same list. Postmark will re-flag immediately.

## Env vars

- `POSTMARK_API_TOKEN` — server API token, set in Vercel Production/Preview/Development
- `POSTMARK_FROM_EMAIL` — verified sender address for transactional mail

When Broadcast stream is added:
- `POSTMARK_BROADCAST_STREAM_ID` — the Broadcast Message Stream id from the Postmark server settings

## Key files

| Purpose | File |
|---|---|
| Email service wrapper (sendEmail) | `lib/services/email-service.ts` |
| Email templates (shared HTML/text builders) | `lib/services/email-templates.ts` |
| Card-issued email | `buildCardIssuedEmail` in email-templates |
| Compliance alert email | `buildComplianceAlertEmail` in email-templates |
| Password reset email | `buildPasswordResetEmail` in email-templates |
