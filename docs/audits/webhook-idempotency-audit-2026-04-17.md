# Webhook Idempotency Audit — 2026-04-17

**Status:** 3 of 4 webhook handlers PROTECTED. 1 UNPROTECTED.
Smoke test on 2026-04-16 confirmed `ProcessedWebhookEvent` unique
constraint fires with P2002; three of four handlers use the shared
util correctly.

## Handlers (PROTECTED)

### app/api/webhooks/stripe/route.ts
- Events: 6 (`issuing_authorization.request`,
  `issuing_authorization.created`, `account.updated`,
  `issuing_dispute.created`/`updated`/`submitted`).
- Idempotency: `markWebhookProcessed` at top, `releaseWebhookEvent`
  on error, return 200 on duplicate.
- Exemption: `issuing_authorization.request` skips dedupe (2s JIT
  decision budget; DB-level idempotent via card + balance re-read)
  — intentional, documented inline (lines 80-84).
- Defense in depth: `handleAuthorizationCreated` checks existing
  `Transaction` by unique `stripeTransactionId`; dispute handlers
  check existing `Notification` by `entityId` before fanning out.
  Dispute inner handlers re-throw errors so the outer catch runs
  `releaseWebhookEvent` (DDIA Ch5 Replication audit fix, visible
  inline).

### app/api/webhooks/stripe-billing/route.ts
- Events: 6 (`checkout.session.completed`,
  `customer.subscription.{created,updated,deleted}`, `invoice.paid`,
  `invoice.payment_succeeded`, `invoice.payment_failed`).
- **Gold standard — three-layer defense:**
  1. Event-id dedupe via `markWebhookProcessed`.
  2. Idempotent upserts on `BillingSubscription` (unique key =
     `organizationId` or `stripeSubscriptionId`).
  3. Monotonic `lastBillingEventAt` high-water mark — every state
     update uses `updateMany` with
     `OR: [{ lastBillingEventAt: null }, { lastBillingEventAt: { lt: eventAt } }]`
     so a late-arriving retry that would regress state is silently
     skipped with a `console.warn` and `count = 0`.

### app/api/webhooks/stripe-charges/route.ts
- Events: 2 (`issuing_authorization.created` for declined,
  `issuing_transaction.created` for completed charges).
- Idempotency: `markWebhookProcessed` at top, `releaseWebhookEvent`
  on money-movement error (line 251-263), defense-in-depth
  existing-`Transaction` check at line 171-177.
- **Minor gap (not launch-blocking):** the declined-auth branch
  (lines 54-119) catches inner errors with `console.error` only —
  it does **not** release idempotency or return 5xx. On a transient
  DB failure while processing a decline, the event is marked
  processed and never re-run. Impact is log/notification loss only
  (no money movement on declined auths), so this is LOW-priority
  cleanup, not launch-blocking.

## Handler UNPROTECTED — priority 1 fix

### app/api/webhooks/stripe/fraud/route.ts
- Events: 3 (`radar.early_fraud_warning.created`,
  `charge.fraud_detected`, `issuing_authorization.request` — fraud
  signal placeholder).
- **No idempotency wiring at all.** The file does not import
  `markWebhookProcessed` or `releaseWebhookEvent` and makes no
  `prisma.processedWebhookEvent.*` call anywhere.
- Inner catches (lines ~146-150, 219-222) return 200 on error,
  meaning Stripe sees success and never retries.
- Failure modes:
  1. **Duplicate fraud notification fan-out** on Stripe retry.
     Every `nonprofit_admin` + `compliance_officer` in the resolved
     org (bounded 100) plus every `platform_admin` (bounded 50) gets
     the alert twice — in-app notification AND email. At 1.9M-org
     scale this burns email-sender reputation and erodes trust in
     the fraud signal ("cry wolf").
  2. **Permanent fraud signal loss** on transient DB error. Inner
     catches swallow the error, Stripe never retries, the fraud
     event is lost. Regulatory implication for compliance posture.

## Fix plan (for next session)

Mechanical fix, estimated **30-45 minutes**:

1. Extend the `WebhookType` union in `lib/webhook-idempotency.ts`
   to include `"stripe-fraud"`.
   (No DB migration needed — `ProcessedWebhookEvent.webhookType`
   is already a free-form `String` column.)
2. In `app/api/webhooks/stripe/fraud/route.ts`:
   - Add
     `import { markWebhookProcessed, releaseWebhookEvent } from "@/lib/webhook-idempotency";`
   - After Stripe signature verification, call
     `const { firstTime } = await markWebhookProcessed(event.id, "stripe-fraud");`
     Return 200 with `{ received: true, deduped: true }` when
     `!firstTime`.
   - Track `processedEventId` in a `let` so the outer catch can
     release it.
   - Change inner catches (lines ~146-150, 219-222) from
     "log and return 200" to **rethrow** — same pattern as the
     dispute handlers in `/api/webhooks/stripe/route.ts` (lines
     799-801, 853-855, 892-894).
   - Outer catch: call `releaseWebhookEvent(processedEventId)`,
     return 500 so Stripe retries.
3. Consider an early-exit for `issuing_authorization.request`
   before the dedupe call (same 2s-budget exemption pattern as
   the sibling `/api/webhooks/stripe` handler). This keeps the
   JIT decision path unaffected if that event type ever lands on
   the fraud endpoint.
4. Verify with the same pattern `scripts/smoke-test-path-b.ts`
   used — insert a `ProcessedWebhookEvent`, attempt a duplicate,
   expect P2002.

## Status
- **Tonight (2026-04-17):** diagnostic complete, fix scoped, not
  executed.
- **Next session:** priority 1, ahead of the HANDLER_HAS_ORG
  review items from the cross-org isolation audit.

## Why deferred
Pre-revenue, zero real fraud traffic. Fix is mechanical but
touches webhook retry semantics — ships better with fresh eyes
than at the end of a 13-hour session. No real risk exposure
increases overnight.
