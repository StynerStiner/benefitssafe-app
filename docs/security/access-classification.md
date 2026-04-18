# BenefitsSafe Access Classification

**Status:** Canonical. BSRS Ch 5 §2 (Classifying Access Based on Risk) applied to this codebase.
**Last updated:** 2026-04-18
**Companion docs:**
- [docs/design-notes/bsrs-ch05-least-privilege-applied.md](../design-notes/bsrs-ch05-least-privilege-applied.md) — full audit and gap inventory
- [docs/runbooks/audit-log-review.md](../runbooks/audit-log-review.md) — weekly review cadence that depends on this classification

## Overview

Not all data and actions are equal. This document formalizes the implicit access classification that already exists across BenefitsSafe's role gates, Prisma scoping middleware, and AuditLog writes — so that:

1. A new engineer can tell at a glance which models and endpoints are high-risk.
2. The weekly audit-log review ([audit-log-review.md](../runbooks/audit-log-review.md)) knows which action categories demand the closest scrutiny.
3. A SOC 2 Type II auditor can trace "this entity is classified X → these are the controls applied" without reverse-engineering the codebase.

The classification is **not** the control — the control is the code (role gates, org-scoped queries, CHECK constraints, transactions, audit writes). The classification is the *reason* a given control is where it is.

## Classification levels

| Level | Description | Read control | Write control | Infrastructure control |
|---|---|---|---|---|
| **Public** | Unauthenticated content: landing pages, marketing site, pricing | None needed | N/A | Edge cache, CDN |
| **Org-internal, read** | Roster data within a single nonprofit: beneficiary list, vendor list, grant status summaries | Session + role + org-scoped Prisma query | N/A | Prisma $extends middleware (shadow mode, Phase 1) |
| **Org-internal, write (non-money)** | Mutations that change org state but do not move money: vendor create, beneficiary invite, document upload | Session + role | Session + role + org-scoped + AuditLog | Prisma middleware + AuditLog immutability |
| **Money-flow, read** | Read-only queries that disclose money movement: LedgerEntry browse, Transaction browse, Grant.remainingAmount | Session + role + org-scoped | N/A | Prisma middleware |
| **Money-flow, write** | Mutations that move or commit money: expense approve, card issue, fund transfer, grant refill | Session + role + org-scoped | `$transaction` + Serializable isolation + retryOnSerializationFailure + CHECK constraints + AuditLog | `lib/org-context.ts` AsyncLocalStorage + Prisma middleware |
| **Platform admin (cross-org)** | Cross-org actions reserved for BenefitsSafe staff: platform stats, breakglass overrides, org suspend | Session + `platform_admin` role only | Session + `platform_admin` + `withOrgContext({ kind: "exempt", reason: "PLATFORM_ADMIN" })` + AuditLog with operator userId | Explicit exempt-wrap required; shadow-mode middleware logs violations |
| **Cryptographic secrets** | Secrets that bootstrap authentication or integrity: NextAuth JWT secret, Stripe webhook secret, Aurora master credential, Anthropic API key | Vercel env vars (prod); `.env.local` (dev) | Rotate on operator departure or suspected compromise | See [aurora-credential-rotation.md](../runbooks/aurora-credential-rotation.md) |
| **System runtime secrets** | Secrets that carry transactional value and must never persist in our DB: Stripe-issued PANs, CVVs, cardholder tokens | Stripe Issuing Elements with ephemeral keys | Never written to our DB | Stripe PCI scope, not ours |

## Entity classification — Prisma models

All 33 models in [prisma/schema.prisma](../../prisma/schema.prisma) are classified below. "Immutable" is not a separate level but a structural property: models that are never updated or deleted after insert.

| Model | Level | Notes |
|---|---|---|
| `Organization` | Platform admin (cross-org) | Create/suspend is platform-only; read within an org is org-internal |
| `User` | Org-internal, write (non-money) | Contains beneficiary PII: DOB, ssnLast4 (masked in API responses), benefit programs. ssnLast4 is NEVER included in AuditLog diffs |
| `OrganizationMembership` | Org-internal, write (non-money) | Phase 1 multi-org model (commit `195b50b`). Per-org roles + notes — authoritative over `User.organizationId` for authorization decisions on multi-org users |
| `InviteToken` | Org-internal, write (non-money) | Single-use tokens, time-bounded |
| `Grant` | **Money-flow, write** | Core money-flow entity. CHECK constraints enforce non-negative balance unless `allowNegativeBalance=true`. Terminal transitions (ARCHIVED, COMPLETED) require a reason (BSRS Ch 5 P2) |
| `BudgetCategory` | Money-flow, write | Per-grant allocation lines; changes affect spend headroom |
| `ExpenseRequest` | Money-flow, write | Approval path is SSI-compliance-critical; every request runs `classifyExpense()` before save |
| `Approval` | Money-flow, write | The approval record itself, alongside AuditLog |
| `VirtualCard` | Money-flow, write | Stripe Issuing card lifecycle. Partial unique index on `(grantId, beneficiaryId) WHERE status='ACTIVE'` (commit `07c6611`) |
| `CardholderEligibility` | Org-internal, write (non-money) | Gate for card issuance, not the issuance itself |
| `Transaction` | Money-flow, read | Settled card activity (written by Stripe webhook, not user action) |
| `LedgerEntry` | Money-flow, read (immutable) | IMMUTABLE. Every money movement writes a ledger row; no updates or deletes |
| `Subscription` | Money-flow, write | Vendor subscriptions billed on the beneficiary's behalf |
| `FundTransfer` | Money-flow, write | Inter-grant or org-level fund movements |
| `Vendor` | Org-internal, write (non-money) | Status transitions PENDING→APPROVED→ACTIVE→BLOCKED. Rejection (BLOCKED) is a high-risk moderation decision; requires reason (BSRS Ch 5 P2) |
| `DisbursementPolicy` | Org-internal, write (non-money) | Org-level payment rules; changes affect every future expense |
| `PromoCode` | Platform admin (cross-org) | Created by platform admins; redemption is org-scoped |
| `PromoRedemption` | Money-flow, write | Applies a PromoCode to an org's billing |
| `BillingSubscription` | Money-flow, write | Our own billing (Stripe customer); not to be confused with `Subscription` (vendor bills) |
| `UsageCounter` | Money-flow, read | Feature-gate counters for plan limits |
| `Document` | Org-internal, write (non-money) | Receipts and compliance documents; access scoped by `organizationId` |
| `Conversation` | Org-internal, write (non-money) | Internal messaging |
| `ConversationParticipant` | Org-internal, read | Membership records in a conversation |
| `Message` | Org-internal, write (non-money) | Message content |
| `Notification` | Org-internal, read | System-generated alerts |
| `CalendarEvent` | Org-internal, write (non-money) | Org calendar entries |
| `GrantReport` | Org-internal, read | Generated report metadata |
| `AuditLog` | Org-internal, read (immutable) | IMMUTABLE. Read access is `platform_admin` + org-scoped `nonprofit_admin`. No API ever returns AuditLog rows from another org |
| `CronCheckpoint` | Platform admin (cross-org) | Written by scheduled jobs; read by platform staff for job health |
| `Integration` | Platform admin (cross-org) | Third-party integration configs (Composio, etc.) |
| `WorkflowTrigger` | Platform admin (cross-org) | Integration workflow definitions |
| `WorkflowLog` | Platform admin (cross-org) | Integration execution trace |
| `ProcessedWebhookEvent` | Platform admin (cross-org) | Stripe webhook idempotency records |

## Endpoint classification — representative routes

This table is **not exhaustive** (95+ routes exist); it lists one representative route per level so that new routes can be classified by analogy.

| Endpoint | Level | Required auth | Required role | Reason justification required? |
|---|---|---|---|---|
| `GET /api/grants` | Money-flow, read | Session | any non-`vendor` | No |
| `POST /api/grants` | Money-flow, write | Session | `nonprofit_admin`, `platform_admin` | No |
| `PATCH /api/grants/[id]` | Money-flow, write | Session | `nonprofit_admin`, `platform_admin` | **Yes** when `status ∈ { ARCHIVED, COMPLETED }` (zod min 10 chars; BSRS Ch 5 P2) |
| `GET /api/grants/[id]` | Money-flow, read | Session | non-`vendor`; beneficiaries see only their own grants | No |
| `POST /api/expenses/[id]/approve` | Money-flow, write | Session | `nonprofit_admin`, `nonprofit_staff`, `compliance_officer` | No (compliance classification is the gate) |
| `POST /api/expenses/[id]/reject` | Money-flow, write | Session | same as approve | Yes (reason field already required by `rejectExpenseSchema`) |
| `GET /api/ledger` | Money-flow, read | Session | non-`vendor`, non-`beneficiary` | No |
| `POST /api/vendors` | Org-internal, write (non-money) | Session | `nonprofit_admin`, `platform_admin` | No |
| `POST /api/vendors/[id]/approve` | Org-internal, write (non-money) | Session | `nonprofit_admin`, `platform_admin` | No |
| `POST /api/vendors/[id]/reject` | Org-internal, write (non-money) | Session | `nonprofit_admin`, `platform_admin` | **Yes** (zod min 10 chars; BSRS Ch 5 P2) |
| `GET /api/beneficiaries/[id]` | Org-internal, read | Session | `nonprofit_admin`, `nonprofit_staff`, `platform_admin` | No |
| `PATCH /api/beneficiaries/[id]` | Org-internal, write (non-money) | Session | `nonprofit_admin`, `nonprofit_staff`, `platform_admin` | **Deferred to P2b** (isActive=false gate requires UI modal work) |
| `GET /api/audit-logs` | Org-internal, read (immutable) | Session | `nonprofit_admin`, `platform_admin`, `auditor` | No |
| `GET /api/platform/stats` | Platform admin (cross-org) | Session | `platform_admin` only | No |
| `POST /api/platform/grants/[id]/reset-negative-balance-flag` | Platform admin (cross-org) — breakglass | Session | `platform_admin` only | **Yes** (zod min 10 chars; the pattern this whole section is modeled after, commit `854a984`) |
| `POST /api/webhooks/stripe` | Money-flow, write (exempt) | Stripe signature | N/A (system) | No (signature verification is the gate) |

### How to classify a new endpoint

1. What does it touch? Look up the primary Prisma model in the entity table above. The endpoint inherits its data's level as a floor.
2. Does it mutate? Read-only endpoints drop from "money-flow, write" to "money-flow, read". Mutations keep the higher level.
3. Is it cross-org? Any endpoint that returns or mutates data outside `session.user.organizationId` is **platform admin (cross-org)** regardless of the underlying model.
4. Is the action reversible? Irreversible terminal transitions (status → ARCHIVED, Vendor → BLOCKED, breakglass overrides) require a zod-validated `reason` field with min 10 chars; the reason goes into `AuditLog.newValue.reason`. Reversible mutations do not.
5. Add the route to the endpoint table above and update the change log below.

## Required justification for high-risk actions

BSRS §5.3 calls these "multi-party authorization equivalents." At solo scale (one engineer/operator), the equivalent is a **written, attributable justification** on every irreversible action — so the weekly audit-log review has enough context to spot an action that was wrong even when the operator at the time believed it was right.

As of commit landing this doc, three actions require a zod-validated reason (min 10 characters):

1. **Grant status → ARCHIVED or COMPLETED** ([app/api/grants/[id]/route.ts](../../app/api/grants/[id]/route.ts))
   - `ARCHIVED`: grant soft-deleted; sets `archivedAt`. Irreversible without platform admin intervention.
   - `COMPLETED`: grant marked finished; remaining balance is frozen. Conceptually irreversible (operational tax implications if reopened).
   - `PAUSED` is intentionally **not** gated — it's reversible and routinely used during legitimate review pauses. Adding friction there would train operators to write noise reasons, which would poison the audit review.
   - Schema: `patchGrantBodySchema` in [lib/validations/grant.ts](../../lib/validations/grant.ts).

2. **Vendor rejection (→ BLOCKED)** ([app/api/vendors/[id]/reject/route.ts](../../app/api/vendors/[id]/reject/route.ts))
   - Blocks every future disbursement to this vendor org-wide. Effectively a moderation decision.
   - Schema: `rejectVendorSchema` in [lib/validations/vendor.ts](../../lib/validations/vendor.ts).

3. **Breakglass: reset negative-balance flag** ([app/api/platform/grants/[id]/reset-negative-balance-flag/route.ts](../../app/api/platform/grants/[id]/reset-negative-balance-flag/route.ts))
   - Platform-only override for the stuck-overspend case documented in [stuck-overspend-grants.md](../runbooks/stuck-overspend-grants.md). Shipped in commit `854a984` as the pattern these later additions follow.

### Persistence

Every reason lands in `AuditLog.newValue.reason` (JSON field). The `AuditLog` model has no dedicated `reason` column; the `newValue` JSON is the stable home. Queryable via:

```sql
SELECT "createdAt", "userId", "entityType", "entityId",
       "newValue"->>'reason' AS reason
FROM "AuditLog"
WHERE "newValue" ? 'reason'
  AND "createdAt" > now() - interval '7 days'
ORDER BY "createdAt" DESC;
```

### Deferred

**Beneficiary deactivation (`PATCH /api/beneficiaries/[id]` with `isActive=false`)** is not yet reason-gated. Two UI callers ([top-performer-card.tsx](../../app/(dashboard)/(homes)/beneficiaries/components/top-performer-card.tsx), [todo-list-recent-card.tsx](../../app/(dashboard)/(homes)/beneficiaries/components/todo-list-recent-card.tsx)) toggle `isActive` with a single click and no text input; gating server-side without UI work would break the toggle. Tracked as **P2b** in the BSRS Ch 5 applied doc §7.

## Change log

| Date | Commit | Change |
|---|---|---|
| 2026-04-03 | `854a984` | `reset-negative-balance-flag` breakglass endpoint ships with zod `reason.min(10)` pattern (pre-dates this doc; the pattern this doc formalizes) |
| 2026-04-18 | (this commit) | Doc created. BSRS Ch 5 P2 reason-gate added to `PATCH /api/grants/[id]` (terminal statuses) and `POST /api/vendors/[id]/reject` |
