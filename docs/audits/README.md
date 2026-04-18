# BenefitsSafe Security & Isolation Audits

This directory holds the findings from point-in-time audits of the
codebase. Each audit is dated and committed so future developers and
auditors have a paper trail of what was reviewed, when, and what the
triage state was.

## Design Notes

Reference material that informs architecture decisions across
sessions. Different from audits, which are point-in-time findings.

- [DDIA Chapter 7 (Transactions) Applied to BenefitsSafe](../design-notes/ddia-ch07-transactions-applied.md) — 2026-04-17

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
- Priority 1 — Prisma middleware to reject queries missing
  `organizationId` on org-scoped models (defense in depth —
  separate PDR). Must whitelist the EXEMPT_CRON / EXEMPT_PLATFORM
  / AUTH_FLOW paths.
- Priority 2 — Release-on-error cleanup for the declined-auth
  branch in `app/api/webhooks/stripe-charges/route.ts` (lines
  54-119). LOW — impacts log/notification loss only, no money
  movement.
- [DDIA Ch7 P4 follow-up] Design conversation on
  `allowNegativeBalance` lifecycle — once set on a Grant the flag
  stays true. Decide reset policy: manual reconciliation, auto on
  first positive-balance restoration, or time-based. Non-urgent;
  current behavior is defensible.

**Action items (closed):**
- 2026-04-17: Cross-org isolation P1 (HANDLER_HAS_ORG money-flow
  files) — 10/10 queries verified safe on adversarial per-query
  review across `app/api/ledger/route.ts`,
  `app/api/expenses/[id]/route.ts`, `app/api/org/fund/route.ts`.
  All safe via one of three patterns: variable-bound where
  clauses (ledger `ledgerWhere`/`transactionWhere`), relational
  scoping (expenses `grant: { organizationId }`), server-created
  id chains (fundTransfer update by local id). Classifier
  false-positive rate: 100% on this subset.
- 2026-04-17: Cross-org isolation P1 (remaining HANDLER_HAS_ORG
  files) — 30-query stratified sample across every model and
  operation pattern in the ~80-query remainder. 30/30 samples
  verified safe on adversarial per-query review. Combined with
  money-flow bucket (10/10), cumulative 40/40 false-positive
  rate across audited subset. Full report at
  `cross-org-isolation-handler-has-org-stratified-2026-04-17.md`.
- 2026-04-17: Cross-org isolation P1 (WEBHOOK_REVIEW bucket) —
  23/23 queries verified safe on detailed per-query review. Every
  query is either the derive step itself, a unique-by-Stripe-ID
  idempotency guard, or a BY_ID_FROM_DERIVED chain lookup. Zero
  cross-org leaks.
- 2026-04-17: AuditLog NOT NULL fix on 4 webhook handler sites
  (commit `54926d8`) — discovered incidentally during
  WEBHOOK_REVIEW verification. Latent runtime bug hidden by
  `@ts-nocheck` that would have caused permanent dispute/fraud
  event loss on first real Stripe traffic (especially the
  `dea1876` `$transaction`-wrapped dispute path).
- 2026-04-17: DDIA Ch7 P5 — `VirtualCard`
  `uniq_active_card_per_grant_beneficiary` partial unique index
  applied to Aurora (commit `07c6611`). Enforces one active card
  per (grant, beneficiary) pair.
- 2026-04-17: DDIA Ch7 P4 — Grant CHECK constraints with
  `allowNegativeBalance` escape hatch (commit `07c6611`). Three
  CHECKs on money columns; overspend path flags the Grant when
  committing a negative-balance debit.
- 2026-04-17: DDIA Ch7 P3 — invite token redemption now uses
  `updateMany` with `usedAt: null` guard (compare-and-set)
  (commit `dab2f0f`). Prevents double-redemption race.
- 2026-04-17: DDIA Ch7 P2 — `handleDisputeCreated` wrapped in
  `prisma.$transaction` (commit `dea1876`). Multi-table dispute
  processing is now atomic; matches sibling `handleTransactionCreated`
  pattern.
- 2026-04-17: DDIA Ch7 P1 — `retryOnSerializationFailure` wrapping
  on `virtual-cards/[id]/close` + `jobs/process-charge` Serializable
  tx sites (commit `70808ee`). Matches gold-standard pattern at
  `approve/route.ts:101`.
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
- **Classifier limitations (observed during verification):**
  The HANDLER_HAS_ORG bucket generator is block-only and cannot
  trace through: (1) variable-aliased where clauses
  (`const w = { organizationId }` then `where: w`), (2)
  relational scoping (`grant: { organizationId }` when the child
  model has no direct `organizationId` column), (3) local
  server-created id chains (`x = create(...); update({ where:
  { id: x.id } })`). These are all correct scoping patterns —
  the classifier simply can't see them. The money-flow subset
  (10/10 queries, P1 closure) produced a 100% false-positive
  rate entirely from these three shapes. Any future re-audit
  should account for this, ideally by extending the analyzer
  to recognize these shapes.
