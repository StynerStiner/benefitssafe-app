#!/usr/bin/env node
// BSRS Ch 5 P4.3 — convention linter that enforces the P4.1 + P4.2 patterns
// going forward.
//
// Run:    node scripts/lint/auth-guard-convention.mjs
// Exit:   0 = pass, 1 = violations found, 2 = script error
//
// Three rules, each applied to every route.ts under app/api/ except those
// in path-based EXCEPTIONS (NextAuth, webhooks, jobs, cron, health — each
// uses a different auth mechanism and is legitimately exempt):
//
//   Rule A — A route that imports `@/auth` must also import
//            `@/lib/auth-guard`. New routes should go through the guard
//            (requireAuth / requireAdmin / etc.) rather than calling auth()
//            directly.
//
//   Rule B — A route must not reference `session.user.role` directly.
//            Use the guard helpers (requireAdmin, requireRole with an
//            explicit role list, etc.) so role checks are uniform and
//            centrally refactorable.
//
//   Rule C — A route must not return a bare
//            `NextResponse.json({ error: "..." }, { status: 4XX/5XX })`.
//            Use `errorResponse()` from `@/lib/error-response` so every
//            error response carries a correlationId and emits a
//            structured `[api_error]` log line for Better Stack.
//
// Allowlists below are GRANDFATHER SNAPSHOTS captured at 2026-04-18 (the
// baseline after P4.2). They are intended to SHRINK over time, never
// grow. Adding a new entry is a one-way ratchet violation — see
// docs/runbooks/auth-guard-convention.md for the policy and the
// exception process.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";

// ────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────

const API_ROOT = "app/api";

/**
 * Path prefixes that skip all three rules. These route trees use auth
 * mechanisms other than NextAuth session (Stripe signatures, cron
 * bearer tokens, QStash job tokens) and do not need the session+role
 * guard pattern.
 */
const EXCEPTIONS = [
  "app/api/auth/",       // NextAuth machinery + password/email flows
  "app/api/webhooks/",   // Stripe signature verification
  "app/api/jobs/",       // QStash verifyJobAuth()
  "app/api/cron/",       // Cron bearer token auth
  "app/api/health/",     // Public health check, no auth
];

/**
 * Rule A allowlist — routes that import `@/auth` but not
 * `@/lib/auth-guard`. Grandfathered as of 2026-04-18 (baseline: 74
 * routes). Do NOT add new entries; migrate the route onto the guard
 * instead. See docs/runbooks/auth-guard-convention.md.
 */
const ALLOWLIST_RULE_A = new Set([
  "app/api/admin/data-deletion/route.ts",
  "app/api/ai/chat/route.ts",
  "app/api/ai/parse-pdf/route.ts",
  "app/api/beneficiaries/[id]/route.ts",
  "app/api/beneficiaries/[id]/verify-eligibility/route.ts",
  "app/api/billing/checkout/route.ts",
  "app/api/billing/portal/route.ts",
  "app/api/billing/status/route.ts",
  "app/api/dashboard/route.ts",
  "app/api/events/[id]/route.ts",
  "app/api/events/route.ts",
  "app/api/expenses/[id]/issue-card/route.ts",
  "app/api/expenses/[id]/reject/route.ts",
  "app/api/expenses/[id]/route.ts",
  "app/api/expenses/route.ts",
  "app/api/grants/[id]/categories/route.ts",
  "app/api/grants/[id]/document/route.ts",
  "app/api/grants/[id]/issue-card/route.ts",
  "app/api/grants/[id]/route.ts",
  "app/api/invite/route.ts",
  "app/api/memberships/[id]/route.ts",
  "app/api/memberships/invite/route.ts",
  "app/api/memberships/route.ts",
  "app/api/memberships/switch/route.ts",
  "app/api/messages/conversations/[id]/join/route.ts",
  "app/api/messages/conversations/[id]/messages/route.ts",
  "app/api/messages/conversations/[id]/route.ts",
  "app/api/messages/conversations/route.ts",
  "app/api/mfa/disable/route.ts",
  "app/api/mfa/setup/route.ts",
  "app/api/mfa/status/route.ts",
  "app/api/mfa/verify-setup/route.ts",
  "app/api/notifications/[id]/route.ts",
  "app/api/notifications/read-all/route.ts",
  "app/api/onboarding/route.ts",
  "app/api/org/disbursement-policy/route.ts",
  "app/api/org/fund/[transferId]/status/route.ts",
  "app/api/org/fund/route.ts",
  "app/api/org/integrations/[provider]/route.ts",
  "app/api/org/integrations/route.ts",
  "app/api/org/link-bank/route.ts",
  "app/api/org/route.ts",
  "app/api/org/stripe-account/route.ts",
  "app/api/org/stripe-onboarding/route.ts",
  "app/api/org/workflows/[triggerId]/route.ts",
  "app/api/org/workflows/logs/route.ts",
  "app/api/org/workflows/route.ts",
  "app/api/org/workflows/usage/route.ts",
  "app/api/organization/route.ts",
  "app/api/organizations/[orgId]/logo/route.ts",
  "app/api/platform/grants/[id]/reset-negative-balance-flag/route.ts",
  "app/api/platform/grants/stuck-overspend/route.ts",
  "app/api/platform/internal-staff/route.ts",
  "app/api/platform/switch-org/route.ts",
  "app/api/policies/route.ts",
  "app/api/promo-codes/route.ts",
  "app/api/reports/export/route.ts",
  "app/api/reports/grants/route.ts",
  "app/api/search/route.ts",
  "app/api/stripe/account-health/route.ts",
  "app/api/subscriptions/[id]/route.ts",
  "app/api/user/data-deletion/route.ts",
  "app/api/user/data-export/route.ts",
  "app/api/users/[id]/route.ts",
  "app/api/users/avatar/route.ts",
  "app/api/users/invite/route.ts",
  "app/api/users/profile/route.ts",
  "app/api/users/route.ts",
  "app/api/vendor/profile/route.ts",
  "app/api/vendors/[id]/payments/route.ts",
  "app/api/virtual-cards/[id]/close/route.ts",
  "app/api/virtual-cards/[id]/pause/route.ts",
  "app/api/virtual-cards/[id]/reveal/route.ts",
  "app/api/virtual-cards/[id]/statement/route.ts",
]);

/**
 * Rule B allowlist — routes that read `session.user.role` directly.
 * Grandfathered as of 2026-04-18 (baseline: 12 routes). Do NOT add new
 * entries; switch to the guard helpers instead.
 */
const ALLOWLIST_RULE_B = new Set([
  "app/api/admin/data-deletion/route.ts",
  "app/api/ai/chat/route.ts",
  "app/api/memberships/switch/route.ts",
  "app/api/organizations/[orgId]/logo/route.ts",
  "app/api/platform/grants/[id]/reset-negative-balance-flag/route.ts",
  "app/api/platform/grants/stuck-overspend/route.ts",
  "app/api/platform/internal-staff/route.ts",
  "app/api/platform/switch-org/route.ts",
  "app/api/promo-codes/route.ts",
  "app/api/user/data-deletion/route.ts",
  "app/api/users/profile/route.ts",
  "app/api/vendor/profile/route.ts",
]);

/**
 * Rule C allowlist — routes with ≥1 bare `NextResponse.json({ error }, {
 * status: 4XX/5XX })` return. Grandfathered as of 2026-04-18 (baseline:
 * 63 routes). Do NOT add new entries; use errorResponse() from
 * @/lib/error-response instead.
 */
const ALLOWLIST_RULE_C = new Set([
  "app/api/admin/data-deletion/route.ts",
  "app/api/ai/chat/route.ts",
  "app/api/ai/parse-pdf/route.ts",
  "app/api/beneficiaries/[id]/verify-eligibility/route.ts",
  "app/api/billing/checkout/route.ts",
  "app/api/billing/portal/route.ts",
  "app/api/billing/status/route.ts",
  "app/api/dashboard/route.ts",
  "app/api/events/[id]/route.ts",
  "app/api/events/route.ts",
  "app/api/expenses/[id]/route.ts",
  "app/api/expenses/route.ts",
  "app/api/grants/[id]/categories/route.ts",
  "app/api/grants/[id]/document/route.ts",
  "app/api/grants/[id]/issue-card/route.ts",
  "app/api/invite/route.ts",
  "app/api/memberships/[id]/route.ts",
  "app/api/memberships/invite/route.ts",
  "app/api/memberships/route.ts",
  "app/api/memberships/switch/route.ts",
  "app/api/messages/conversations/[id]/join/route.ts",
  "app/api/messages/conversations/[id]/messages/route.ts",
  "app/api/messages/conversations/[id]/route.ts",
  "app/api/messages/conversations/route.ts",
  "app/api/mfa/disable/route.ts",
  "app/api/mfa/setup/route.ts",
  "app/api/mfa/status/route.ts",
  "app/api/mfa/verify-setup/route.ts",
  "app/api/notifications/[id]/route.ts",
  "app/api/notifications/read-all/route.ts",
  "app/api/onboarding/route.ts",
  "app/api/org/disbursement-policy/route.ts",
  "app/api/org/integrations/[provider]/route.ts",
  "app/api/org/integrations/route.ts",
  "app/api/org/link-bank/route.ts",
  "app/api/org/route.ts",
  "app/api/org/stripe-account/route.ts",
  "app/api/org/workflows/[triggerId]/route.ts",
  "app/api/org/workflows/logs/route.ts",
  "app/api/org/workflows/route.ts",
  "app/api/org/workflows/usage/route.ts",
  "app/api/organization/route.ts",
  "app/api/organizations/[orgId]/logo/route.ts",
  "app/api/platform/grants/stuck-overspend/route.ts",
  "app/api/platform/internal-staff/route.ts",
  "app/api/platform/switch-org/route.ts",
  "app/api/policies/route.ts",
  "app/api/promo-codes/route.ts",
  "app/api/reports/export/route.ts",
  "app/api/reports/grants/route.ts",
  "app/api/search/route.ts",
  "app/api/subscriptions/[id]/route.ts",
  "app/api/user/data-deletion/route.ts",
  "app/api/user/data-export/route.ts",
  "app/api/users/[id]/route.ts",
  "app/api/users/avatar/route.ts",
  "app/api/users/invite/route.ts",
  "app/api/users/profile/route.ts",
  "app/api/users/route.ts",
  "app/api/vendor/profile/route.ts",
  "app/api/vendors/[id]/payments/route.ts",
  "app/api/virtual-cards/[id]/pause/route.ts",
  "app/api/virtual-cards/[id]/reveal/route.ts",
]);

// ────────────────────────────────────────────────────────────────────
// Core logic
// ────────────────────────────────────────────────────────────────────

function toPosix(p) {
  return p.split(/[\\/]/).join("/");
}

/** Recursively collect every `route.ts` under `dir`. */
function walkRoutes(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkRoutes(full));
    } else if (st.isFile() && entry === "route.ts") {
      out.push(toPosix(full));
    }
  }
  return out;
}

function isExempt(routePath) {
  return EXCEPTIONS.some((prefix) => routePath.startsWith(prefix));
}

const IMPORT_AUTH_RE = /from\s+["']@\/auth["']/;
const IMPORT_GUARD_RE = /from\s+["']@\/lib\/auth-guard["']/;
const SESSION_ROLE_RE = /\bsession\.user\.role\b/;
const BARE_ERROR_RE =
  /NextResponse\.json\(\s*\{\s*error\s*:[^}]*\}\s*,\s*\{\s*status\s*:\s*[45]\d\d/;

/** Return per-line matches for a regex, each with `{ line, text }`. */
function findLineMatches(content, regex) {
  const hits = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) hits.push({ line: i + 1, text: lines[i].trim() });
  }
  return hits;
}

function checkRuleA(routePath, content) {
  const importsAuth = IMPORT_AUTH_RE.test(content);
  const importsGuard = IMPORT_GUARD_RE.test(content);
  return importsAuth && !importsGuard;
}

function checkRuleB(content) {
  return findLineMatches(content, SESSION_ROLE_RE);
}

function checkRuleC(content) {
  return findLineMatches(content, BARE_ERROR_RE);
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────

function main() {
  let routes;
  try {
    routes = walkRoutes(API_ROOT).sort();
  } catch (err) {
    console.error(`[auth-guard-convention] fatal: failed to walk ${API_ROOT}:`, err.message);
    process.exit(2);
  }

  const violations = [];

  for (const route of routes) {
    if (isExempt(route)) continue;

    let content;
    try {
      content = readFileSync(route, "utf8");
    } catch (err) {
      console.error(`[auth-guard-convention] fatal: failed to read ${route}:`, err.message);
      process.exit(2);
    }

    if (checkRuleA(route, content) && !ALLOWLIST_RULE_A.has(route)) {
      violations.push({
        rule: "A",
        route,
        hint:
          'Imports `@/auth` but not `@/lib/auth-guard`. New routes must go ' +
          'through the guard (requireAuth / requireAdmin / etc.) rather ' +
          'than calling auth() directly.',
      });
    }

    const ruleBHits = checkRuleB(content);
    if (ruleBHits.length > 0 && !ALLOWLIST_RULE_B.has(route)) {
      for (const hit of ruleBHits) {
        violations.push({
          rule: "B",
          route,
          line: hit.line,
          excerpt: hit.text,
          hint:
            'Direct `session.user.role` access. Use a guard helper ' +
            '(requireAdmin / requireRole with an explicit role list / etc.) ' +
            'so role checks remain uniform and refactorable.',
        });
      }
    }

    const ruleCHits = checkRuleC(content);
    if (ruleCHits.length > 0 && !ALLOWLIST_RULE_C.has(route)) {
      for (const hit of ruleCHits) {
        violations.push({
          rule: "C",
          route,
          line: hit.line,
          excerpt: hit.text,
          hint:
            'Bare NextResponse.json error return. Use errorResponse() from ' +
            '@/lib/error-response so the response carries a correlationId ' +
            'and emits a structured [api_error] log line.',
        });
      }
    }
  }

  const checked = routes.filter((r) => !isExempt(r)).length;
  const exempt = routes.length - checked;

  if (violations.length === 0) {
    console.log(
      `auth-guard-convention: pass (${checked} routes checked, ${exempt} exempt)`,
    );
    console.log(
      `  allowlist baseline: Rule A=${ALLOWLIST_RULE_A.size}, ` +
        `Rule B=${ALLOWLIST_RULE_B.size}, Rule C=${ALLOWLIST_RULE_C.size} ` +
        `(should shrink over time — see docs/runbooks/auth-guard-convention.md)`,
    );
    process.exit(0);
  }

  console.error(
    `auth-guard-convention: FAIL — ${violations.length} violation(s) in ${checked} routes checked`,
  );
  console.error("");
  for (const v of violations) {
    const loc = v.line ? `${v.route}:${v.line}` : v.route;
    console.error(`  [Rule ${v.rule}] ${loc}`);
    if (v.excerpt) console.error(`    ${v.excerpt}`);
    console.error(`    ${v.hint}`);
    console.error("");
  }
  console.error(
    "Fix guidance: docs/runbooks/auth-guard-convention.md",
  );
  process.exit(1);
}

main();
