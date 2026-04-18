# BenefitsSafe Security & Isolation Audits

This directory holds the findings from point-in-time audits of the
codebase. Each audit is dated and committed so future developers and
auditors have a paper trail of what was reviewed, when, and what the
triage state was.

## 2026-04-17: Webhook idempotency audit

See `webhook-idempotency-audit-2026-04-17.md`.

**Summary:** 3 of 4 webhook handlers correctly wired via
`lib/webhook-idempotency.ts` (`stripe`, `stripe-billing`,
`stripe-charges`). 1 handler — `stripe/fraud` — had no idempotency
wiring at all and would have dropped fraud signals on transient DB
errors and fanned out duplicate notifications on Stripe retries.
**Fixed in commit `1fb4df5` (2026-04-17)** — all 4 handlers now
protected.

## 2026-04-17: Cross-org isolation audit

**Scope:** every Prisma query in the codebase (742 total,
`lib/generated` excluded) against the 27 org-scoped models.

**Headline findings:**
- 0 true cross-org leaks discovered
- 7 queries classified TRUE_UNSCOPED (handler file contains no
  `organizationId` reference) — all reviewed, all safe patterns
  (self-scoped via `session.user.id`, or intentionally platform-wide
  metric)
- 90 queries in HANDLER_HAS_ORG bucket — handler references
  `organizationId` but the specific query block doesn't. Needs
  per-query review to confirm the scope-via-precondition pattern.
- 23 Stripe webhook queries to review for the derive-org-from-
  Stripe-ID pattern
- 25 BY_ID queries with handler-level org context — low risk

**Classification table (all 742):**

| Class | Count | Meaning |
|---|---:|---|
| SCOPED | 409 | Explicit `organizationId` / relation / compound-unique in the query block |
| EXEMPT_SCRIPT | 110 | Tests, seeds, migrations, scripts |
| HANDLER_HAS_ORG | 90 | Query block unscoped but handler references `organizationId` — needs review |
| NON_ORG_MODEL | 33 | Global / user-scoped / nested models (InviteToken, PromoCode, etc.) |
| BY_ID_WITH_HANDLER_ORG | 25 | `findUnique(where: {id})` after a scoped precondition |
| EXEMPT_CRON | 24 | System cron jobs — platform-wide by design |
| WEBHOOK_REVIEW | 23 | Stripe webhook handlers — need derive-org pattern review |
| EXEMPT_PLATFORM | 11 | `/api/platform/*` and `/api/admin/*` cross-org routes |
| AUTH_FLOW | 10 | Pre-session lookups (login, password reset) |
| TRUE_UNSCOPED | 7 | Handler has no `organizationId` reference anywhere — all reviewed, all safe |

**Files:**
- `cross-org-isolation-audit-2026-04-17.tsv` — full classified list
  (742 rows, columns: class, file, line, model, op, ftype)
- `cross-org-isolation-true-unscoped-2026-04-17.txt` — the 7 high-
  scrutiny candidates, with query context (all cleared)
- `cross-org-isolation-handler-has-org-2026-04-17.txt` — 90-row gray
  bucket with query context for per-query human review
- `cross-org-isolation-webhook-review-2026-04-17.txt` — 23 Stripe
  webhook queries with context

**Action items (open):**
- Priority 1 — Review WEBHOOK_REVIEW bucket for cross-org
  derive-org-from-Stripe-ID pattern (~1 hour). Start with
  `app/api/webhooks/stripe/route.ts` (11 queries — highest
  concentration).
- Priority 2 — Review HANDLER_HAS_ORG money-flow files (~1 hour):
  `app/api/ledger/route.ts`, `app/api/expenses/[id]/route.ts`,
  `app/api/org/fund/route.ts`.
- Priority 3 — Review remaining HANDLER_HAS_ORG files (~2-3 hours).
- Priority 4 — Prisma middleware to reject queries missing
  `organizationId` on org-scoped models (defense in depth —
  separate PDR). Must whitelist the EXEMPT_CRON / EXEMPT_PLATFORM
  / AUTH_FLOW paths.
- Priority 5 — Release-on-error cleanup for the declined-auth
  branch in `app/api/webhooks/stripe-charges/route.ts` (lines
  54-119). LOW — impacts log/notification loss only, no money
  movement.

**Action items (closed):**
- 2026-04-17: Fraud webhook idempotency (commit `1fb4df5`) —
  wired `stripe-fraud` through `markWebhookProcessed` /
  `releaseWebhookEvent`, matching sibling `stripe/route.ts`
  pattern. See `webhook-idempotency-audit-2026-04-17.md`.
- `lib/composio-usage.ts:33` annotated as intentionally platform-wide
  (see commit that added `docs/audits/`).
- 7/7 TRUE_UNSCOPED queries individually reviewed and cleared.

**Methodology notes:**
- Heuristic classifier with handler-level context refinement. First
  pass (block-only) flagged 149 UNSCOPED; refinement (file-level
  `organizationId` presence) collapsed that to 7 TRUE_UNSCOPED,
  all of which turned out to be safe patterns on manual review.
- Known limitation: the classifier doesn't trace upstream parameter
  flow across file boundaries. A query that receives a pre-scoped
  parameter from an imported helper shows as scoped only if the
  consuming file also references `organizationId`. In practice this
  rarely creates false negatives — nearly every handler that uses
  scoped parameters also reads `organizationId` from `session` in
  the same file.
- Full run is reproducible from the Python classifier in the
  conversation transcript for 2026-04-17.
