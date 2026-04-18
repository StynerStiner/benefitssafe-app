# Prisma Client Extension for Org-Scoping Enforcement

**Status:** Design only — no implementation in this PDR.
**Audit link:** Priority 1 from [docs/audits/README.md](../audits/README.md) after the 2026-04-17 isolation audit.
**Target commit:** Design doc commits independently; implementation lands in the follow-up PDR.

## Goal

Provide a runtime safety net that catches any Prisma query on an org-scoped model that is not properly scoped to the caller's organization. The isolation audits (WEBHOOK_REVIEW 23/23, HANDLER_HAS_ORG money-flow 10/10, HANDLER_HAS_ORG stratified 30/30) proved the current codebase has zero real leaks — this extension prevents *future* regressions from landing.

**Non-goals:**
- Replacing code review. The extension is defense-in-depth, not the primary control.
- Eliminating raw-SQL queries. `$queryRaw` / `$executeRaw` bypass the extension by construction; they must be reviewed by hand.
- Retroactively "fixing" the existing safe patterns (variable-bound, relational, server-created id). Those are correct — the extension sees the resolved runtime shape, which exposes the same `where.organizationId` the classifier misses at build time.

## Scope

### Org-scoped models (extension enforces)

From the 2026-04-17 audit, the 27 org-scoped models:

```
Organization, User, OrganizationMembership, Grant, BudgetCategory,
ExpenseRequest, Vendor, Subscription, VirtualCard, Transaction,
LedgerEntry, Approval, AuditLog, Document, DisbursementPolicy,
FundTransfer, Notification, CalendarEvent, Integration,
WorkflowTrigger, WorkflowLog, GrantReport, UsageCounter,
CardholderEligibility, PromoRedemption, Conversation,
BillingSubscription
```

Each model has a **primary scoping field**, in most cases `organizationId` directly. A handful scope via a relation whose child does not carry `organizationId`:

| Model | Primary scope | Alt relational scope |
|---|---|---|
| ExpenseRequest | `organizationId` (denormalized) | `grant: { organizationId }` |
| LedgerEntry | `organizationId` (denormalized) | `grant: { organizationId }` |
| Transaction | `organizationId` | `card: { organizationId }` (vendor-dashboard path) |
| BudgetCategory | — | `grant: { organizationId }` |
| Approval | — | `expenseRequest: { organizationId }` |
| PromoRedemption | `organizationId` | — |
| Message | — | (non-org-scoped — parent Conversation is scoped) |

Special cases:
- **User**: shared across orgs via `OrganizationMembership`. Direct `User.organizationId` exists but is "last-active" and is the wrong filter for multi-org contexts. The extension must treat `OrganizationMembership` membership as a valid scoping path for User queries inside multi-org handlers (see `app/api/users/[id]/route.ts` and `app/api/beneficiaries/[id]/route.ts`).
- **Conversation**: scoped via `organizationId`; child `Message` and `ConversationParticipant` rely on precondition findFirst on Conversation.

### Non-org-scoped models (extension skips)

```
InviteToken, PromoCode, CronCheckpoint, ProcessedWebhookEvent,
Message, ConversationParticipant
```

These are:
- Pre-session tokens (auth flow)
- Platform-wide idempotency/leader-lock rows
- Children of already-scoped parents

The extension short-circuits to allow on every query against these models.

## Context mechanism

The extension needs to know, for the current request:
- Which organization the caller is operating as (if any)
- Whether the request is an exempt context (cron, webhook pre-derive, auth flow, platform admin, platform metric, stats admin)

### Option A: AsyncLocalStorage (recommended)

Node.js built-in `async_hooks.AsyncLocalStorage`. No new dependencies. Works in Node runtime (Next.js route handlers default to Node). Not available in Edge runtime, but the codebase has no Prisma-from-Edge paths.

```ts
// lib/org-context.ts
import { AsyncLocalStorage } from "node:async_hooks";

export type OrgContext =
  | { kind: "session"; organizationId: string; userId: string; role: string }
  | { kind: "exempt"; reason: ExemptReason; note?: string };

export type ExemptReason =
  | "CRON"
  | "WEBHOOK_DERIVE"
  | "AUTH_FLOW"
  | "PLATFORM_ADMIN"
  | "PLATFORM_METRIC"  // the lib/composio-usage.ts:33 case
  | "STATS_ADMIN";     // the stripe/account-health:40 case

export const orgContextStore = new AsyncLocalStorage<OrgContext>();

export function withOrgContext<T>(ctx: OrgContext, fn: () => Promise<T>): Promise<T> {
  return orgContextStore.run(ctx, fn);
}

export function getOrgContext(): OrgContext | undefined {
  return orgContextStore.getStore();
}
```

Every route handler wraps its body after authentication:

```ts
// Before
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return unauthorized();
  const expense = await prisma.expenseRequest.findFirst({ where: {...} });
  // ...
}

// After
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return unauthorized();
  return withOrgContext(
    { kind: "session", organizationId: session.user.organizationId, userId: session.user.id, role: session.user.role },
    async () => {
      const expense = await prisma.expenseRequest.findFirst({ where: {...} });
      // ...
    },
  );
}
```

Cron and webhooks use the exempt form:

```ts
// Cron
return withOrgContext({ kind: "exempt", reason: "CRON", note: CRON_NAME }, async () => { ... });

// Webhook pre-derive (before org is known)
return withOrgContext({ kind: "exempt", reason: "WEBHOOK_DERIVE", note: "stripe" }, async () => {
  // derive org from Stripe ID here, queries allowed to be cross-org-shape
  // ... after derive, optional nested withOrgContext to tighten scope
});
```

**Pros:** zero new deps, native Node, survives `await` boundaries, no per-handler refactor beyond a wrap.
**Cons:** every handler needs the wrap. Risk: a new handler forgets the wrap → all queries in it go unchecked (extension sees `getOrgContext() === undefined`). Mitigation: the extension **fails when ALS context is missing on an org-scoped query** — that's a dev-time loud error, safer than allowing uncontextualized queries through.

### Option B: Explicit client-per-request

`getScopedPrisma(orgId)` factory returning a fresh extended client. Requires every handler to obtain a per-request client. Breaks the global-singleton pattern in `lib/db.ts`. Refactor cost across 90+ routes is large, and more importantly, every new handler would need to know about this pattern. ALS sets up the context once and forgets it. **Rejected.**

### Option C: Query-level metadata flag

Require each query to pass a `__context` flag for exempt operations. Unworkable: the whole point is that devs forget scoping, so we can't trust them to flag every exemption. **Rejected.**

### Recommendation: **Option A** (AsyncLocalStorage + handler wrapping).

**Helper to simplify rollout:** introduce `defineApiRoute(handler, { exempt? })` that does auth + ALS wrap + error boundary in one place, so new handlers opt in by using the helper. Existing handlers can be migrated gradually. This is a separate PDR after the extension ships.

## Enforcement algorithm

The Prisma v7 client extension API hooks at `$extends({ query: { model: { operation: async ({ args, query, model }) => ... } } })`. Per-model, per-operation hooks. We register a hook for **every org-scoped model's every operation** (findMany, findFirst, findUnique, count, aggregate, groupBy, create, createMany, update, updateMany, upsert, delete, deleteMany).

### Phase 1: mutation operations (UPDATE/DELETE/UPSERT)

Highest-risk surface. Algorithm:

1. `ctx = getOrgContext()`. If `ctx.kind === "exempt"` → log (dev) or metric (prod), run query.
2. If `ctx === undefined` → **throw in dev**, log + run in prod (missing wrap is a bug, but the query might still be correct — don't break prod).
3. If `args.where` contains `organizationId: <truthy>` at top level → verify it matches `ctx.organizationId` (mismatch → throw/log), run query.
4. If model has an alt relational scoping path (e.g., ExpenseRequest's `grant.organizationId`) and `args.where` includes that path with a `organizationId` whose value matches `ctx.organizationId` → run query.
5. If `args.where` is a by-unique-id shape (`{ id }`, `{ id, <otherFilters> }` without `organizationId`) → **this is the precondition pattern**. The extension cannot verify the precondition ran in the same handler. Options (see [Rollout plan](#rollout-plan)): log-only in shadow; escalate to throw/log in later phases with an escape hatch.
6. Otherwise → throw/log as unscoped mutation.

### Phase 2: read operations (findMany/findFirst/findUnique/count/aggregate/groupBy)

Same steps 1–4.
Step 5: **findUnique** by primary key is inherently a by-unique-id shape. Same precondition question as mutations.
Step 6: reads without org scoping → throw/log.

### Phase 3: create/createMany

1. `ctx = getOrgContext()`. If exempt → allow + log.
2. If `ctx.kind === "session"`: require `args.data.organizationId === ctx.organizationId`. If missing or mismatched → throw/log.
3. For createMany: validate every row in `args.data` carries the matching `organizationId`.

## Exemption mechanisms

### By execution context

Set at the wrapping boundary. The extension defers to the context:

| Reason | Set at | Scope |
|---|---|---|
| `CRON` | `app/api/cron/*/route.ts` | Entire cron handler |
| `WEBHOOK_DERIVE` | Top of `app/api/webhooks/*/route.ts` | Until org is known; optionally nest a `session`-kind context after derive |
| `AUTH_FLOW` | `app/api/auth/login`, `forgot-password`, `accept-invite`, etc. | Entire pre-session flow |
| `PLATFORM_ADMIN` | `app/api/platform/*`, `app/api/admin/*` | Entire handler |
| `PLATFORM_METRIC` | One-off wrap at `lib/composio-usage.ts:33` | Just that query |
| `STATS_ADMIN` | Inside the platform-admin branch at `app/api/stripe/account-health/route.ts:40` | Just the cross-org findMany |

### By explicit per-query escape hatch

For the rare query that needs to bypass the extension without a handler-wide exempt context, expose a query-argument escape:

```ts
await prisma.organization.findMany({
  where: { stripeAccountId: { not: null } },
  // Marks this single query as intentionally cross-org.
  // Surfaced in logs so we can audit usage.
} as const);
```

Implementation: extension checks for a sentinel field on `args` (stripped before passing to Prisma). Keep this path rare; every usage requires a comment explaining why.

### By inherent query shape

By-id queries (`findUnique`, `update({ where: { id } })`, etc.) cannot be verified against precondition context by the extension. Mitigation: the extension does not throw on by-id in normal enforcement mode. It records a counter `prisma_by_id_queries_total{model}` for visibility, and Phase 3 rollout introduces an opt-in strict mode that requires an explicit precondition-verified flag.

## Fail mode

### Development (`NODE_ENV !== "production"`)

Throw `OrgScopingViolation` with:
- Model, operation, offending `where` shape
- Current ALS context (or "undefined — missing withOrgContext wrap")
- Stack trace

Tests must exercise both the "wrapped" and "unwrapped" paths, so test harness needs a helper to construct context.

### Production (`NODE_ENV === "production"`)

Do NOT throw. Do NOT modify the query. Do:
- Structured log via the existing Better Stack pipeline: `console.error("[org-scoping] violation", { ... })`
- Sentry capture via `Sentry.captureMessage` at `warning` level (not `error` — we don't want to page on-call for every violation until we tune false-positive rate)
- Metric: `prisma_org_scoping_violation_total{model,operation,ctx_kind}`
- Proceed with query

Rationale: breaking a live request on a false-positive is worse than logging. After 2 weeks in shadow mode we re-evaluate based on real volume.

## Rollout plan

### Phase 1 — shadow mode (~1 week)

Extension installed. Every org-scoped query **logged** but nothing thrown, nothing blocked. Dashboard: violation rate per model. Exit criteria: baseline established, no production errors correlated with the extension, false-positive sources identified and whitelisted.

### Phase 2 — mutations-only enforcement (~1 week)

UPDATE / DELETE / UPSERT / createMany throw in dev and log loudly in prod. Reads still shadow. Exit criteria: no dev-env throws from legitimate code paths for 3+ days.

### Phase 3 — full enforcement

All operations throw in dev, log in prod. By-id precondition mode opt-in. Exit criteria: zero violations in prod for 1 week.

## Illustrative code signature

```ts
// lib/prisma-org-scoping-extension.ts
import { Prisma } from "@/lib/generated/prisma/client";
import { getOrgContext } from "@/lib/org-context";
import { logViolation, throwIfDev } from "@/lib/prisma-org-scoping-reporter";

const ORG_SCOPED_MODELS = new Set([
  "Organization", "User", "OrganizationMembership", "Grant", /* ... */
]);

type ScopingCheck = (args: unknown, ctxOrgId: string) => "ok" | "unscoped" | { mismatch: string };

const MODEL_SCOPING: Record<string, ScopingCheck[]> = {
  Grant: [checkDirect("organizationId")],
  ExpenseRequest: [checkDirect("organizationId"), checkRelational("grant", "organizationId")],
  LedgerEntry: [checkDirect("organizationId"), checkRelational("grant", "organizationId")],
  Transaction: [checkDirect("organizationId"), checkRelational("card", "organizationId")],
  // ...
};

export const orgScopingExtension = Prisma.defineExtension({
  name: "org-scoping",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!ORG_SCOPED_MODELS.has(model)) return query(args);
        const ctx = getOrgContext();
        if (!ctx) {
          throwIfDev(`[org-scoping] missing withOrgContext wrap at ${model}.${operation}`);
          logViolation({ kind: "missing_context", model, operation });
          return query(args);
        }
        if (ctx.kind === "exempt") {
          logViolation({ kind: "exempt", reason: ctx.reason, model, operation });
          return query(args);
        }
        const checkResult = checkOrgScoping(model, operation, args, ctx.organizationId);
        if (checkResult === "ok") return query(args);
        throwIfDev(`[org-scoping] unscoped query at ${model}.${operation}`);
        logViolation({ kind: "unscoped", model, operation, where: safeStringify(args) });
        return query(args);
      },
    },
  },
});
```

Applied in `lib/db.ts`:

```ts
const baseClient = createPrismaClient();
export const prisma = baseClient.$extends(orgScopingExtension);
```

One subtle point: `$extends` returns a new client type. Every existing `import { prisma } from "@/lib/db"` continues to work, but the type is now the extended client. Prisma handles this cleanly at the type level.

## Open questions

1. **Raw SQL bypasses the extension.** `$queryRaw`, `$executeRaw`, `$queryRawUnsafe` are not intercepted by the `query` hook because they skip the model layer entirely. Policy: discourage raw SQL on org-scoped models. Where raw is used (cron reconciliation has a few `$executeRaw` for partial unique indexes), a separate lint rule or review checklist covers it.

2. **Transaction clients.** Queries inside `prisma.$transaction(async (tx) => { ... })` go through `tx`, which in v7 is the same extended client. The extension hook fires for tx queries. Verified against Prisma docs; to be confirmed in the implementation PDR with a unit test.

3. **`OrganizationMembership`-based User queries.** The multi-org pattern in `app/api/users/[id]` and `app/api/beneficiaries/[id]` does:
   ```ts
   const membership = await prisma.organizationMembership.findFirst({ where: { userId: id, organizationId } });
   if (!membership) return 404;
   const user = await prisma.user.findUnique({ where: { id } });
   ```
   The second query is a by-id `findUnique` on `User` with no `organizationId`. The extension cannot prove the membership precondition fired. Options:
   - **Whitelist** `User.findUnique` by-id when ALS context has a recent (same-request) `OrganizationMembership.findFirst` that succeeded.
   - **Explicit flag** on the second query (`{ __scopedBy: "membership" }`).
   - **Phase 3 deferral**: log-only for this shape.
   Recommendation: Phase 3 deferral. Mark as a known exception, document in this file.

4. **`$transaction` with array form.** `prisma.$transaction([q1, q2, q3])` composes pre-built query promises. The extension still fires per-query, and ALS context persists. No special handling needed.

5. **Extension vs singleton pattern.** `lib/db.ts` caches the client on `globalThis` to survive HMR and avoid creating new pools. `$extends` returns a new object each call. Apply `$extends` ONCE, cache the extended client (not the base) on `globalThis`. Implementation PDR will update `lib/db.ts` accordingly.

6. **Test harness.** Need a helper `runWithContext(ctx, fn)` for test files so unit tests can exercise the extension. Jest/Vitest globals picking up the extension will throw on every unwrapped test query today — migration of existing tests is part of the implementation PDR.

7. **Performance.** Each query adds a function call, a Set lookup, an ALS read, and a shape check. Benchmarks in the implementation PDR — target overhead under 200µs per query at p99. If the check is too expensive, consider sampling (e.g., 10% of queries in production) while still enforcing 100% in dev.

## Prisma v7-specific constraints (confirmed from diagnostic)

- Prisma 7.5.0 installed (confirmed in `package.json`). Legacy `$use` middleware is **removed**. Only `$extends` works.
- `PrismaPg` adapter from `@prisma/adapter-pg` is used in `lib/db.ts`. The extended client wraps this — no interaction with the adapter.
- Custom Pool configuration (max: 5, connectionTimeoutMillis: 10_000) is orthogonal. Extension does not touch connection handling.
- Client is globally cached via `globalForPrisma.prisma` (HMR-safe singleton). Apply `.$extends` before assigning to the global.

## Summary: what the implementation PDR must deliver

1. `lib/org-context.ts` — ALS store + `withOrgContext` + `getOrgContext` + `OrgContext` types.
2. `lib/prisma-org-scoping-extension.ts` — extension with model/operation hooks.
3. `lib/prisma-org-scoping-reporter.ts` — dev throw / prod log+metric.
4. `lib/db.ts` — apply `.$extends(orgScopingExtension)`, re-cache on global.
5. Per-route migration — every `/api/**/route.ts` wraps its body in `withOrgContext`. Aim for a `defineApiRoute` helper to keep the call site compact.
6. Tests — unit tests for the extension (wrapped ok, wrapped bad, unwrapped, each exempt reason). Integration test hitting a handler end-to-end with both safe and unsafe shapes.
7. Rollout config — `PRISMA_ORG_SCOPING_MODE` env var: `off` / `shadow` / `mutations` / `full`, default `shadow` until Phase 2 ship.

Estimated effort: 8–12 hours spread over two implementation PDRs (extension + per-route migration).
