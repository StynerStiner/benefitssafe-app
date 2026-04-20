// DDIA Ch12 F7 — unified Stripe idempotency key construction.
//
// Why a single helper:
//   Before this file, 14 call sites hand-rolled `${prefix}-${orgId}-${...}`
//   strings inline. Each site picked its own separator, its own prefix
//   convention, and its own (lack of) length guard. A typo in any one site
//   silently broke dedup for that money path — with no compile-time or
//   runtime signal. Centralizing the construction eliminates that class of
//   bug and makes cross-path dedup auditable (one file to grep).
//
// Separator choice: `|` (U+007C).
//   UUIDv4 values contain `-` in fixed positions; the prior `-` separator
//   made keys like `ibt-${cuidOrg}-${uuidRequestId}` ambiguous to split
//   back into components. `|` never appears inside UUIDs, cuids, email
//   local-parts, or Stripe IDs — unambiguous.
//
// Length guard: Stripe caps idempotency keys at 255 characters. Inputs
// can grow (email addresses, multi-UUID card routes) and hitting the cap
// produces a Stripe 400 at the worst possible moment (during a money
// move). When the joined string would exceed 255 chars, we SHA-256 the
// whole thing and return `${scope}|sha256:${hex}`. The scope prefix is
// preserved so logs + Stripe's dashboard still show which path emitted
// the key; the hex suffix is a stable 64-char fingerprint of the full
// inputs — same inputs still produce the same output.
//
// Determinism: this is a pure function. Same `scope` + same `parts` in
// the same order produces the same string every call. No clock reads,
// no random. Bucket-based inputs (5-minute buckets for session endpoints,
// UUID requestIds for money endpoints) stay the responsibility of the
// caller — the helper never injects time or entropy.
//
// Cutover note: switching the separator from `-` to `|` changes the
// exact key bytes emitted by every path. In-flight retries whose first
// attempt produced an old-format key will, post-deploy, emit a new-format
// key — Stripe will treat it as a fresh idempotent operation. For paths
// with a DB-level @@unique gate (FundTransfer.requestId, ExpenseRequest
// requestId), P2002 catches the retry before the Stripe call, so no
// duplicate money-move risk. Paths without a DB layer (bare card
// issuance, customer creation) carry a brief double-submit window
// during the deploy cutover — accepted as a one-time cost.

import { createHash } from "node:crypto";

/** Stripe's hard cap on idempotency-key length. */
export const STRIPE_IDEMPOTENCY_KEY_MAX_LENGTH = 255;

/** Separator used to join `scope` + `parts`. Chosen to never collide with
 *  UUIDs, cuids, or Stripe IDs. */
export const STRIPE_IDEMPOTENCY_KEY_SEPARATOR = "|";

/**
 * Build a Stripe idempotency key from a descriptive scope and one or
 * more parts. The scope should tell a reader which code path emitted
 * the key (e.g. `"signup-acct"`, `"ibt"`, `"card-grant"`); parts are
 * the dedup-identifying inputs (org id, request UUID, time bucket).
 *
 * Examples:
 *   stripeIdempotencyKey("ibt", orgId, requestId)
 *     → "ibt|clxyz|7b3c...f2a"
 *   stripeIdempotencyKey("checkout", orgId, tier, bucket5min)
 *     → "checkout|clxyz|growth|9745321"
 *   stripeIdempotencyKey("card-grant", grantId, beneficiaryId, mode)
 *     → "card-grant|clg|clb|connected"
 *
 * If the joined string would exceed 255 chars, returns
 * `${scope}|sha256:${hexDigest}` — deterministic fingerprint that
 * still fits.
 */
export function stripeIdempotencyKey(
  scope: string,
  ...parts: string[]
): string {
  const joined = [scope, ...parts].join(STRIPE_IDEMPOTENCY_KEY_SEPARATOR);
  if (joined.length <= STRIPE_IDEMPOTENCY_KEY_MAX_LENGTH) {
    return joined;
  }
  const hash = createHash("sha256").update(joined).digest("hex");
  return `${scope}${STRIPE_IDEMPOTENCY_KEY_SEPARATOR}sha256:${hash}`;
}
