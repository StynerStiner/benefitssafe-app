# BSRS Ch 8 P2b — Retrofit Catalog

## Purpose

Authoritative checklist for the three P2b retrofit cycles. Every route
here gets `assertDbHealthy()` at the top of its try{} + a
`DbUnavailableError` catch branch mapping to 503 + Retry-After. Pattern
established in commit f9e4c43 (P2a); see `lib/db-health.ts` and the 5
canonical routes retrofitted there for reference.

This is a pre-ship inventory, not a guarantee — each tier's Phase 1
diagnostic must re-grep before retrofitting. Catalog drift is possible
between Phase 1 closure and Tier N kickoff if new write routes land.

## Counts

| Category | Count |
|---|---|
| Raw POST/PUT/PATCH/DELETE handlers across app/api/ | 83 |
| P2a already-retrofitted | 5 |
| Exempt — webhooks (external retry + ProcessedWebhookEvent idempotency) | 4 |
| Exempt — auth (natural Aurora-unavailable failure path; no double-gate) | 6 |
| Exempt — QStash jobs (external retry semantics) | 5 |
| **P2b retrofit target** | **63** |

## Exemption rationale

**Webhooks** (4): `webhooks/{stripe, stripe/fraud, stripe-charges, stripe-billing}`. Stripe retries on 5xx with exponential backoff; ProcessedWebhookEvent table makes handlers idempotent. A 503 from the gate just converts to a Stripe-side retry ~30s later; same net effect with extra noise.

**Auth** (6): `auth/{register, accept-invite, forgot-password, reset-password, record-login, resend-verification}`. These must talk to Aurora to do anything useful — if Aurora is down, they'll fail via the natural Prisma error path. Double-gating them with `assertDbHealthy()` produces the same 503 outcome with worse ergonomics (two error shapes instead of one).

**QStash jobs** (5): `jobs/{process-charge, run-compliance, send-notification, generate-report, check-thresholds}`. QStash has its own retry + DLQ semantics. A 503 returned to QStash triggers retry on the next scheduled execution, which is what we want anyway.

**P2a canonical 5** (retrofitted in f9e4c43): `grants/POST`, `grants/[id]/issue-card/POST`, `beneficiaries/[id]/PATCH`, `platform/expiring-grants/POST`, `org/fund/POST`.

## Tier 1 — beneficiary-facing / active-user flows (19 files, 24 methods)

Blast radius: a 504 during an Aurora incident hits an active user in the middle of a task (creating expense, pausing card, sending message). Highest urgency for degraded-mode signaling.

```
app/api/beneficiaries/route.ts                         POST
app/api/beneficiaries/[id]/verify-eligibility/route.ts POST
app/api/expenses/route.ts                              POST
app/api/expenses/[id]/route.ts                         PATCH+DELETE
app/api/expenses/[id]/approve/route.ts                 PATCH
app/api/expenses/[id]/reject/route.ts                  PATCH
app/api/expenses/[id]/issue-card/route.ts              POST
app/api/virtual-cards/[id]/pause/route.ts              POST
app/api/virtual-cards/[id]/close/route.ts              POST
app/api/documents/route.ts                             POST
app/api/notifications/route.ts                         DELETE+PATCH
app/api/notifications/[id]/route.ts                    PATCH+DELETE
app/api/notifications/read-all/route.ts                POST
app/api/messages/conversations/route.ts                POST
app/api/messages/conversations/[id]/messages/route.ts  POST
app/api/messages/conversations/[id]/join/route.ts      POST
app/api/events/route.ts                                POST
app/api/events/[id]/route.ts                           PATCH+DELETE
app/api/grants/[id]/document/route.ts                  POST+DELETE
```

**Test-mock work for Tier 1:**
- `__tests__/api/virtual-cards-close-circuit.test.ts` — add `vi.mock("@/lib/db-health"...)` (currently missing; will 503 post-retrofit).
- `__tests__/api/expenses.test.ts` — verify if schema-only; if handler invoked, add mock.

## Tier 2 — admin / platform / org-settings writes (25 files, ~32 methods)

Blast radius: operator (nonprofit admin, platform admin) hits 504 during settings or onboarding change. Lower urgency than Tier 1 (non-active-user) but higher than Tier 3 (higher frequency).

```
app/api/grants/[id]/route.ts                                       PATCH
app/api/grants/[id]/categories/route.ts                            POST
app/api/org/route.ts                                               PATCH
app/api/org/stripe-onboarding/route.ts                             POST
app/api/org/link-bank/route.ts                                     POST+PATCH
app/api/org/disbursement-policy/route.ts                           POST
app/api/org/workflows/route.ts                                     POST
app/api/org/workflows/[triggerId]/route.ts                         PATCH+DELETE
app/api/org/integrations/route.ts                                  POST
app/api/org/integrations/[provider]/route.ts                       DELETE
app/api/vendors/route.ts                                           POST
app/api/vendors/[id]/route.ts                                      PATCH+DELETE
app/api/vendors/[id]/approve/route.ts                              POST
app/api/vendors/[id]/reject/route.ts                               POST
app/api/policies/route.ts                                          PATCH
app/api/memberships/[id]/route.ts                                  DELETE
app/api/memberships/invite/route.ts                                POST
app/api/memberships/switch/route.ts                                POST
app/api/users/invite/route.ts                                      POST
app/api/users/[id]/route.ts                                        PATCH+DELETE
app/api/invite/route.ts                                            POST
app/api/platform/expiring-grants/[id]/route.ts                     PATCH+DELETE
app/api/platform/grants/[id]/reset-negative-balance-flag/route.ts  POST
app/api/platform/switch-org/route.ts                               POST
app/api/platform/internal-staff/route.ts                           POST
```

**Test-mock work for Tier 2:**
- `__tests__/api/expiring-grants.test.ts` — extend existing P2a db-health mock to cover `[id]` PATCH+DELETE.
- `__tests__/api/grants.test.ts` — verify if handler invoked; mockPrisma is full-shape, likely needs db-health mock.
- `__tests__/api/vendors.test.ts` — verify if schema-only; likely no-op.

## Tier 3 — low-frequency / profile / billing / MFA (19 files, ~19 methods)

Blast radius: user updates profile, admin toggles MFA, promo-code verification. Lowest frequency, smallest concurrent-user impact during an incident.

```
app/api/users/profile/route.ts              PATCH
app/api/users/avatar/route.ts               POST
app/api/user/data-deletion/route.ts         POST
app/api/admin/data-deletion/route.ts        POST
app/api/mfa/setup/route.ts                  POST
app/api/mfa/verify/route.ts                 POST
app/api/mfa/verify-setup/route.ts           POST
app/api/mfa/disable/route.ts                POST
app/api/subscriptions/route.ts              POST
app/api/subscriptions/[id]/route.ts         PATCH
app/api/billing/portal/route.ts             POST
app/api/billing/checkout/route.ts           POST
app/api/vendor/profile/route.ts             PATCH
app/api/ai/parse-pdf/route.ts               POST
app/api/ai/chat/route.ts                    POST
app/api/organizations/[orgId]/logo/route.ts POST
app/api/promo-codes/route.ts                POST
app/api/promo-codes/verify/route.ts         POST
app/api/verify-ein/route.ts                 POST
```

**Test-mock work for Tier 3:** zero. No test file in `__tests__/` exercises any Tier 3 route handler (verified by cross-referencing the 10 `vi.mock("@/lib/db")` files against the Tier 3 list).

## Retrofit pattern (unchanged from P2a)

For each route file:

```typescript
import { assertDbHealthy, DbUnavailableError } from "@/lib/db-health";

export async function POST(...) {
  try {
    await assertDbHealthy();            // first line inside try{}
    // ... existing handler logic ...
  } catch (error) {
    if (error instanceof DbUnavailableError) {    // FIRST catch branch
      return errorResponse({
        kind: "dependency_unavailable",
        message: "Aurora is currently unavailable; please retry.",
        route: ROUTE,
        method: "POST",
        retryAfterSeconds: Math.ceil(error.cooldown_ms_remaining / 1000),
        cause: error,
      });
    }
    // ... existing error mapping ...
  }
}
```

For each test file that `vi.mock("@/lib/db")` on a retrofitted route:

```typescript
vi.mock("@/lib/db-health", () => ({
  assertDbHealthy: vi.fn(() => Promise.resolve()),
  DbUnavailableError: class extends Error {
    cooldown_ms_remaining = 30_000;
  },
}));
```

## Commit sequence

1. Tier 1 — 19 file retrofit + 1-2 test-mock extensions.
2. Tier 2 — 25 file retrofit + 1-2 test-mock extensions.
3. Tier 3 — 19 file retrofit, no test-mock work.
4. Convention linter — `scripts/lint/db-health-convention.mjs`. For every file in `app/api/` that exports POST/PUT/PATCH/DELETE, require either `assertDbHealthy(` somewhere in the file OR presence on a 20-entry exemption allowlist (15 standard + 5 P2a canonical, though P2a-canonical aren't exempt — they already retrofit, so they pass the `assertDbHealthy(` check). Fail CI on violation. ~60 LOC, zero-dep Node 22 ES module matching the P4.3 + credential-freshness linters.
5. Doc close — single-line edit to §5 scorecard in `bsrs-ch08-resilience-applied.md` marking P2b CLOSED in the three tier hashes + linter hash.

## LOC estimate

| Commit | Route LOC (~5/method) | Test-mock LOC | Linter | Doc | Total |
|---|---|---|---|---|---|
| Tier 1 | ~135 | ~30 | — | — | ~165 |
| Tier 2 | ~160 | ~25 | — | — | ~185 |
| Tier 3 | ~95 | 0 | — | — | ~95 |
| Linter | — | — | ~60 | — | ~60 |
| Catalog doc (this file) | — | — | — | ~200 | ~200 |
| Doc close | — | — | — | ~5 | ~5 |
| **Total** | ~390 | ~55 | ~60 | ~205 | **~710** |
