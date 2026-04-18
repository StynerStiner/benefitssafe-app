# Auth-Guard Convention Linter

**Script:** [scripts/lint/auth-guard-convention.mjs](../../scripts/lint/auth-guard-convention.mjs)
**CI step:** `.github/workflows/ci.yml` — blocking, runs after vitest.
**Companion docs:**
- [BSRS Ch 5 applied doc §7 P4](../design-notes/bsrs-ch05-least-privilege-applied.md) — why this exists
- [docs/security/access-classification.md](../security/access-classification.md) — what it protects

## Purpose

The linter prevents regression of the patterns shipped in BSRS Ch 5 P4.1 (correlation IDs) and P4.2 (shared role-guard helper). Without it, a future PR can silently reintroduce the 5-line session+role copy-paste block or a bare `NextResponse.json({ error }, { status })` — and the blast radius of those regressions (lost correlationId → harder debugging, divergent role gates → future refactor sweep) only shows up months later.

This is a **grep-based** linter, not a TypeScript AST analyzer. False positives are obvious; false negatives are the failure mode we actively guard against.

## The three rules

### Rule A — Guard import

**What:** A route that imports `@/auth` must also import `@/lib/auth-guard`.

**Why:** New routes should obtain session + role via the guard helpers (`requireAuth`, `requireAdmin`, `requirePlatformAdmin`, `requireNonprofitStaff`, `requireNonVendor`, `requireRole`) rather than calling `auth()` directly and handling the null-check + role-check inline. When the session shape changes, or we add MFA re-check, or we migrate to `OrganizationMembership.role` as authoritative, it's a 1-file edit to [lib/auth-guard.ts](../../lib/auth-guard.ts) — not a sweep across 95 files.

**How to fix:**
```ts
// ❌ Before
import { auth } from "@/auth";
// ...
const session = await auth();
if (!session?.user) return errorResponse({ kind: "unauthorized", ... });
if (session.user.role !== "nonprofit_admin") return errorResponse({ kind: "forbidden", ... });

// ✅ After
import { GuardDenial, requireAdmin } from "@/lib/auth-guard";
// ...
try {
  const { userId, organizationId } = await requireAdmin(ROUTE, "POST");
  // business logic
} catch (error) {
  if (error instanceof GuardDenial) return error.toErrorResponse();
  return errorResponse({ kind: "internal", ..., cause: error });
}
```

### Rule B — No direct `session.user.role` access

**What:** A route must not reference `session.user.role` directly.

**Why:** Direct reads bypass the guard's centralized role taxonomy. When the role model evolves (adds a role, splits a role, moves to membership-level roles), every `session.user.role` reference is a migration site. Guard helpers compose around `requireRole(ctx, allowedRoles, ...)` so role lists are explicit, linter-greppable, and trivially refactorable.

**How to fix:** Convert to a guard helper call. For an arbitrary role list (e.g., an 8-role audit-log access list), use the primitive:
```ts
const ctx = await requireAuth(ROUTE, "GET");
requireRole(ctx, ALLOWED_ROLES, ROUTE, "GET");
const { organizationId } = ctx;
```

### Rule C — No bare error returns

**What:** A route must not return `NextResponse.json({ error: "..." }, { status: 4XX | 5XX })`.

**Why:** Bare error responses don't carry a correlationId and don't emit a structured `[api_error]` log line, so user-reported errors are a guessing game for the operator. `errorResponse()` from [lib/error-response.ts](../../lib/error-response.ts) adds correlationId + structured Better Stack logging for every error response in one call.

**How to fix:**
```ts
// ❌ Before
return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

// ✅ After
return errorResponse({
  kind: "not_found",
  message: "Vendor not found",
  route: ROUTE,
  method: "POST",
  userId,
  organizationId,
});
```

## The allowlist is a one-way ratchet

Three allowlists live in the script: Rule A (74 routes), Rule B (12 routes), Rule C (63 routes). They are **grandfather snapshots captured at 2026-04-18** — the state of the codebase after P4.2 shipped. They exist because retrofitting all legacy routes in a single PDR would be too large.

**Policy — reading required before any allowlist change:**

1. **New routes NEVER get allowlisted.** If a new route would be non-compliant, the answer is to fix the route, not to grow the allowlist. The whole point of the linter is to stop this regression class at PR time.

2. **Every allowlist addition requires:**
   - A commit-message paragraph explaining *why this specific route cannot comply right now*
   - A documented plan for eventual removal (a date, a trigger, or "when we migrate X")
   - Reviewer signoff (at solo scale, a note-to-future-self in the commit body and/or runbook entry)

3. **The allowlist should only ever shrink.** Every time we migrate a legacy route onto the guard / errorResponse, we remove its entry. Over time the allowlists approach zero, at which point all three rules become unconditional and the legacy debt is gone.

4. **There is no "just this once" exception.** A tempting shortcut is to add a route to the allowlist with a TODO to "migrate later." That TODO never gets done. Prefer refactoring the route in the same PR, even if it means a small follow-up diff.

5. **The allowlists are load-bearing.** If you find yourself editing `ALLOWLIST_RULE_A` / `ALLOWLIST_RULE_B` / `ALLOWLIST_RULE_C` in [scripts/lint/auth-guard-convention.mjs](../../scripts/lint/auth-guard-convention.mjs), re-read this runbook first.

## The path-based exceptions (not the same as allowlists)

Five directory prefixes unconditionally skip all three rules:

| Prefix | Reason |
|---|---|
| `app/api/auth/` | NextAuth machinery; password/email flows with their own auth bootstrapping |
| `app/api/webhooks/` | Stripe signature verification, not session-based |
| `app/api/jobs/` | QStash `verifyJobAuth()`, bearer-token auth |
| `app/api/cron/` | Cron bearer-token auth |
| `app/api/health/` | Public health check, no auth needed |

Unlike allowlists, exceptions are **categorical** — any route under those prefixes is legitimately using a different auth mechanism. Adding a new exception requires the same policy discipline as adding an allowlist entry (explain *why*, plan for eventual removal if applicable). In practice, these five rarely change.

## Current allowlist state (baseline 2026-04-18)

| Rule | Baseline size | Direction |
|---|---|---|
| Rule A (auth import without guard) | **74** | should shrink |
| Rule B (direct session.user.role) | **12** | should shrink |
| Rule C (bare error returns) | **63** | should shrink |

If these numbers grow, something has gone wrong — either the policy wasn't followed, or the linter itself has a bug that let a regression land. Track them over time: the linter prints the counts on every pass so a CI run shows the current baseline.

## Running the linter

**Locally:**
```sh
node scripts/lint/auth-guard-convention.mjs
```

Expected runtime: ~0.1–0.2s for ~119 routes. Exit codes:

- `0` — pass
- `1` — violations found (reported with file:line and fix hint)
- `2` — script error (filesystem read failure, etc.)

**In CI:** runs automatically in `.github/workflows/ci.yml` immediately after vitest, before eslint. Blocking — a failure fails the PR.

## When the linter fires

If a CI run surfaces a violation:

1. Read the rule name and the file:line excerpt. Each violation includes a one-paragraph fix hint.
2. Apply the "How to fix" pattern from the relevant rule section above.
3. Run the linter locally (`node scripts/lint/auth-guard-convention.mjs`) to confirm the fix.
4. Commit and push.

If you're tempted to add the route to the allowlist instead of fixing it, re-read the "one-way ratchet" section.
