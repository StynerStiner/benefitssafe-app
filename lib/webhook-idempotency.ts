// Webhook idempotency helper.
//
// Stripe retries failed webhook deliveries for up to 3 days. If a retry
// lands while the original handler is still running (or reprocesses an
// event the app already handled), the result can be double-ledger debits,
// double-approvals, or duplicated notifications. At 1.8M tenants with
// bursty webhook load, this is not a theoretical concern.
//
// Pattern: before any side-effecting work, each webhook handler calls
// markWebhookProcessed(event.id, "<type>"). The helper attempts an atomic
// insert into ProcessedWebhookEvent keyed on event.id:
//
//   - New event -> insert succeeds, returns { firstTime: true }. Handler
//     proceeds with processing.
//   - Retry / concurrent duplicate -> Prisma throws P2002 (unique
//     constraint), returns { firstTime: false }. Handler short-circuits
//     and returns 200 immediately so Stripe stops retrying.
//
// The insert is committed independently of the processing transaction on
// purpose: if processing later fails and the handler returns non-2xx,
// Stripe will retry, the idempotency row will already exist, and the
// retry will be swallowed as a duplicate. That's wrong — we want retries
// to actually re-run after failures.
//
// Mitigation: a failed handler must DELETE the row before returning an
// error response, so the next retry re-enters the processing path. Use
// releaseWebhookEvent() for that.

import { prisma } from "@/lib/db";

export type WebhookType = "stripe" | "stripe-charges" | "stripe-billing" | "stripe-fraud";

export interface IdempotencyResult {
  firstTime: boolean;
}

/**
 * Record a webhook event id as processed. Returns firstTime:true if this
 * is a new event (caller should proceed), firstTime:false if it's a
 * duplicate (caller should return 200 and skip).
 *
 * Uses Prisma's P2002 unique-violation catch so concurrent inserts from
 * two Lambda instances racing on the same retry both resolve correctly:
 * one wins with firstTime:true, the other gets firstTime:false.
 */
export async function markWebhookProcessed(
  eventId: string,
  webhookType: WebhookType,
): Promise<IdempotencyResult> {
  try {
    await prisma.processedWebhookEvent.create({
      data: { id: eventId, webhookType },
    });
    return { firstTime: true };
  } catch (err) {
    // Prisma P2002: unique constraint violation = already processed
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { firstTime: false };
    }
    // Any other DB error is a real problem — re-throw so the caller
    // fails loud instead of silently treating the event as new.
    throw err;
  }
}

/**
 * Undo a prior markWebhookProcessed() call. Use this when the handler
 * committed the idempotency row but then failed before completing its
 * side-effects, so the next Stripe retry can re-enter processing cleanly.
 *
 * Best-effort: if the delete fails (e.g. DB already gone), the caller
 * still needs to return its original error response; swallow it.
 */
export async function releaseWebhookEvent(eventId: string): Promise<void> {
  try {
    await prisma.processedWebhookEvent.delete({ where: { id: eventId } });
  } catch {
    // Row may have been purged or never existed. Nothing we can do.
  }
}
