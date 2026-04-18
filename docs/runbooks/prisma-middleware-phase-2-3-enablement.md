# Prisma Middleware — Phase 2 & Phase 3 Enablement

## Background

Phase 1 shipped in commit `9428032` as a Prisma client `$extends` middleware
in shadow mode — every query against an org-scoped model is classified and
logged, but no query is ever blocked. Four representative handlers were
wrapped with `withOrgContext` as proof-of-concept:
`app/api/expenses/[id]/route.ts`, `app/api/cron/reconciliation/route.ts`,
`app/api/webhooks/stripe/route.ts`, and `app/api/platform/stats/route.ts`.

The remaining ~90 unwrapped routes are tracked as Phase 2a (noise reduction,
separate effort). Phase 2/3 enablement — flipping shadow-mode logs into
actual enforcement — is gated on real telemetry showing the extension has
zero false positives and zero guard-internal bugs. This runbook converts
that gate into a 5-minute checklist.

## Log shape reference

The Phase 1 extension at `lib/prisma-org-scoping.ts` logs via
`console.warn` / `console.info` with this exact format:

```
[org_scoping_shadow] {"tag":"<tag>","model":"...","operation":"...","details":"...","ctxKind":"session"|"exempt"|"none"}
```

Possible `tag` values:

| Tag | Meaning |
|---|---|
| `shadow_violation` | Query that would fail Phase 2 enforcement. `ctxKind` distinguishes wrapped routes (`session`/`exempt`) from the 90 unwrapped routes (`none`). |
| `telemetry` | Safe queries flagged for visibility: `byid_implicit` (a `findUnique({ where: { id } })` with no upstream org check visible inline) and `unknown_model` (model not in either scoping whitelist yet). |
| `extension_error` | A bug in the guard's classifier itself. Must be 0. |

These logs ship to Better Stack via Vercel's log drain as **plaintext
messages** — the JSON is embedded in the message string, not surfaced as
structured top-level fields. All queries below therefore substring-match
against the `message` column.

If the Better Stack integration is ever rewired to use the `@logtail/next`
`Logger` instance at `lib/logger.ts` (which emits structured JSON fields),
rewrite the queries to match top-level fields like `tag`, `model`, `ctxKind`
instead of substring matches.

## Phase 2 — dev-throw on mutations

### Precondition check

After **≥ 48 hours** of Phase 1 running in production, open Better Stack
and run the following two queries against the last 48h window:

**Query A — any extension bug?**

```
message CONTAINS "[org_scoping_shadow]" AND
message CONTAINS "\"tag\":\"extension_error\""
```

**Query B — any shadow_violation from wrapped routes?**

`ctxKind != "none"` means the violation came from a handler that already
calls `withOrgContext` — i.e., a genuine false positive that would throw
in dev under Phase 2 if unfixed. `ctxKind == "none"` comes from the 90
unwrapped routes and is expected noise until Phase 2a.

```
message CONTAINS "[org_scoping_shadow]" AND
message CONTAINS "\"tag\":\"shadow_violation\"" AND
NOT message CONTAINS "\"ctxKind\":\"none\""
```

### Decision threshold

| Query A count | Query B count | Action |
|---|---|---|
| `== 0` | `== 0` | **PROCEED** to code change below. |
| `> 0` | any | **FIX FIRST.** The guard has a bug that enforcement would amplify. Open each matching log, read the `err` field, and patch `classifyQuery()` in `lib/prisma-org-scoping.ts`. Do not proceed until Query A count is 0 over a fresh 48h window. |
| `== 0` | `> 0` | **INVESTIGATE.** Group results by the `{model, operation, details}` triple — each unique triple is one false positive that will throw in dev. Either fix the handler's `withOrgContext` call, add a relational scope entry in `RELATIONAL_SCOPE`, or (if legitimately cross-org) mark the call exempt. Re-run Query B after each fix; proceed only when it hits 0 over a fresh 48h window. |

### Code change (only after precondition passes)

In `lib/prisma-org-scoping.ts`, add the error class at the top of the file
(after the existing imports):

```ts
export class OrgScopingViolation extends Error {
  constructor(
    public details: string,
    public context: { model: unknown; operation: unknown },
  ) {
    super(
      `Org scoping violation: ${details} on ${String(context.model)}.${String(
        context.operation,
      )}`,
    );
    this.name = "OrgScopingViolation";
  }
}
```

Inside `$allOperations`, modify the existing `shadow_violation` branch so
mutations throw in dev:

```ts
if (verdict.kind === "shadow_violation") {
  console.warn(
    "[org_scoping_shadow]",
    JSON.stringify({
      tag: "shadow_violation",
      model,
      operation,
      details: verdict.details,
      ctxKind: ctx?.kind ?? "none",
    }),
  );
  // Phase 2: dev-throw on mutations.
  const mutationOps = new Set([
    "create",
    "update",
    "delete",
    "upsert",
    "createMany",
    "updateMany",
    "deleteMany",
  ]);
  if (
    process.env.NODE_ENV === "development" &&
    mutationOps.has(operation as string)
  ) {
    throw new OrgScopingViolation(verdict.details, { model, operation });
  }
}
```

Commit + push. **No Vercel production deploy is strictly required for
Phase 2** — the throw is NODE_ENV-scoped and will never fire in Vercel
production builds. The commit is still pushed so dev builds on every
developer's machine pick up the enforcement.

### Verification post-deploy

In local dev (`npm run dev -- -p 3002`):

1. Write a throwaway API route or script that calls `prisma.grant.update`
   **without** a surrounding `withOrgContext`. Expect an
   `OrgScopingViolation` thrown synchronously.
2. Wrap the same call in
   `withOrgContext({ kind: "session", organizationId: "..." }, async () => { ... })`
   with a matching `organizationId` in the `data`. Expect success silently.
3. Delete the throwaway route when done.

## Phase 2b — dev-throw on reads

### Precondition check

Wait **≥ 48 additional hours** after Phase 2 has landed and developers
have been working against the new dev-throw. This surfaces lower-frequency
read patterns (dashboards opened occasionally, admin tools) that Phase 2
mutations would have missed.

Re-run Query A and Query B from Phase 2 over the past 48h window.

### Decision threshold

Same as Phase 2: both counts must be `== 0` to proceed. Same remediation
paths for non-zero counts.

### Code change

In the same branch in `lib/prisma-org-scoping.ts`, remove the `mutationOps`
filter so any operation throws in dev:

```ts
if (verdict.kind === "shadow_violation") {
  console.warn(/* unchanged */);
  if (process.env.NODE_ENV === "development") {
    throw new OrgScopingViolation(verdict.details, { model, operation });
  }
}
```

### Verification post-deploy

In local dev, call `prisma.grant.findMany({ where: { status: "ACTIVE" } })`
from an unwrapped context. Expect `OrgScopingViolation`. Wrap it and
expect success.

## Phase 3 — production enforcement

### Precondition

All of the following must be true:

1. **Phase 2b has been in dev for ≥ 1 week** with no blocking reports
   from the dev team (track in a Slack thread or incident-free dev-loop
   note).
2. **Phase 2a wrapping migration is complete.** The ~90 unwrapped routes
   tracked in `docs/audits/README.md` must all call `withOrgContext`.
   Otherwise every one of them will start throwing in production.
3. **Query A count == 0 AND Query B count == 0 over the past 7 days**
   (not 48h — production enforcement needs a longer clean window than
   dev enforcement).
4. **Query C — any shadow_violation from wrapped routes including
   previously-unwrapped ones?** Same as Query B but drop the
   `NOT ... ctxKind == none` clause, since by now every route should be
   wrapped:

   ```
   message CONTAINS "[org_scoping_shadow]" AND
   message CONTAINS "\"tag\":\"shadow_violation\""
   ```

   Must be `== 0` over the past 7 days.

### Code change

Remove the `process.env.NODE_ENV === "development"` gate from the throw:

```ts
if (verdict.kind === "shadow_violation") {
  console.warn(/* unchanged */);
  throw new OrgScopingViolation(verdict.details, { model, operation });
}
```

If Sentry is wired up by this point, also `Sentry.captureException` the
violation before throwing so production incidents surface in the usual
alerting path.

Commit, push, **and** run `vercel --prod` (per
`project_vercel_manual_deploy.md`: deploys on `benefits-safe-app` are
manual, git push does NOT trigger).

### Verification post-deploy

Smoke-test a known-safe flow in production immediately after deploy
(e.g., load a wrapped handler's page). The guard's double `try/catch`
means a bug in the classifier cannot block a real query, but an
enforcement regression could still throw a correct query by accident.
Watch Better Stack for the first 10 minutes — any new `OrgScopingViolation`
log lines from the wrapped production paths mean roll back immediately.

### Rollback

Revert the Phase 3 code-change commit and redeploy (`vercel --prod`).
Because the extension is structured with a double `try/catch`, a bug in
the guard's classifier **cannot** block a correct query — worst case is
a spurious throw that the revert removes.

## Emergency: disable the extension entirely

If Phase 2 or Phase 3 causes problems that can't wait for a targeted
code fix:

1. In `lib/db.ts`, comment out the `.$extends(orgScopingExtension())`
   line and commit.
2. `git push` + `vercel --prod`.
3. The middleware is now a no-op; every query passes through unmodified.
4. Re-enable by reverting the commented-out line when fixed.

## Related

- Phase 1 implementation: `lib/prisma-org-scoping.ts` and `lib/org-context.ts`
- Design rationale: `docs/design-notes/prisma-org-scoping-extension-design.md`
- Audit context: `docs/audits/README.md` (§ "2026-04-17: Cross-org
  isolation audit")
- Reference endpoint using `withOrgContext`:
  `app/api/platform/stats/route.ts`
