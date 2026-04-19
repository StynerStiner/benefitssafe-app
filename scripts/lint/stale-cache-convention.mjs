#!/usr/bin/env node
// BSRS Ch 8 P2c — stale-cache convention linter.
//
// Read-path counterpart to scripts/lint/db-health-convention.mjs. Enforces
// the pattern introduced in BSRS Ch 8 P2c Phase 1 (commit `33f583b`) and
// rolled out across Tier 1 (`0626a72`), Tier 2 (`302b605`), and Tier 3
// (`0e7f691`): every GET route under app/api/ must either serve a
// degraded-mode stale response via `cachedWithStaleness` (paired with
// X-Data-Staleness headers and an errorResponse on "unavailable"), OR
// appear in the EXEMPTIONS set below with a reason.
//
// Run:    node scripts/lint/stale-cache-convention.mjs
// Exit:   0 = pass, 1 = violations found, 2 = script error
//
// Rule — Every route.ts under app/api/ that exports GET must either (a)
//        reference `cachedWithStaleness` somewhere in the file, OR (b)
//        appear in the EXEMPTIONS set below.
//
// Exemption categories (27 routes total), each exempt for a specific
// reason that makes the stale-cache fallback unnecessary or unsafe:
//
//   NOT-APPLICABLE (13) — routes that do not fit the P2c contract:
//     - cron handlers (8): QStash-triggered, no user-facing response;
//       an Aurora outage should surface as a retry in the queue, not
//       be masked by a cached response.
//     - auth flows (2): accept-invite + verify-email must read the
//       *live* token state; a stale cached "still valid" response
//       would defeat one-time-use semantics.
//     - integrations OAuth callback (1): redirects back to Composio
//       with state that must be committed live.
//     - health endpoint (1): observability of the health check itself
//       must never be cached.
//     - billing/checkout-direct (1): unauth redirect-only; no Aurora
//       query, no session, no cacheable payload.
//
//   MUST-HIT-AURORA (14) — routes where stale data would be actively
//     harmful regardless of degraded mode:
//     - ledger (1) + audit-logs (1): compliance / immutable records;
//       stale-cached entries create an illusion of completeness that
//       could mislead an auditor or attorney.
//     - beneficiaries/[id]/verify-eligibility (1) + user/data-export
//       (1): live eligibility + PII export; a stale "eligible" answer
//       could produce an IRS/SSI classification error.
//     - virtual-cards/[id]/reveal (1) + statement (1): PAN / PCI scope;
//       degraded-mode caching would extend the data's residency beyond
//       the PCI-compliant read path.
//     - stripe/account-health (1) + org/stripe-onboarding (1) +
//       org/stripe-account (1) + org/link-bank (1) + org/fund (1) +
//       org/fund/[transferId]/status (1): live Stripe connector state
//       and wire-transfer status; polling these is point-in-time by
//       definition, and stale data would show "PENDING" when the
//       transfer has already settled (or vice versa).
//     - search (1): full-text search over live Aurora indexes; stale
//       results would mis-rank and silently hide newly added records.
//     - reports/export (1): returns a binary Buffer (CSV / PDF) —
//       not JSON-serializable through the stale-cache write-through,
//       and compliance-critical enough to warrant a hard 504 over a
//       stale export (FM-9).
//
// Matching: exact relative-path equality against a Set. Directory-prefix
// matching (e.g., startsWith("app/api/cron/")) is rejected here so a
// future non-exempt route added under one of these directories cannot
// slip through the gate by accident. Same safety posture as
// scripts/lint/db-health-convention.mjs.
//
// Companion to scripts/lint/db-health-convention.mjs (P2b),
// scripts/lint/auth-guard-convention.mjs (P4.3), and
// scripts/lint/credential-freshness.mjs (P4). Same invocation shape.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────

const API_ROOT = "app/api";

const EXEMPTIONS = new Set([
  // NOT-APPLICABLE — no P2c treatment needed
  // Cron handlers (QStash-triggered, no user response)
  "app/api/cron/compliance/route.ts",
  "app/api/cron/revoke-expired-grants/route.ts",
  "app/api/cron/reconciliation/route.ts",
  "app/api/cron/reports/route.ts",
  "app/api/cron/card-expiration/route.ts",
  "app/api/cron/sentinel/route.ts",
  "app/api/cron/check-unanswered/route.ts",
  "app/api/cron/reconcile-orphan-stripe-cards/route.ts",
  // Auth flows (one-time-use token semantics must read live state)
  "app/api/auth/accept-invite/route.ts",
  "app/api/auth/verify-email/route.ts",
  // OAuth callback (redirect-only, commits live state)
  "app/api/org/integrations/callback/route.ts",
  // Health observability itself (never cache)
  "app/api/health/route.ts",
  // Billing checkout-direct (unauth redirect-only; no Aurora query)
  "app/api/billing/checkout-direct/route.ts",

  // MUST-HIT-AURORA — stale data would be actively harmful
  // Compliance / immutable records
  "app/api/ledger/route.ts",
  "app/api/audit-logs/route.ts",
  // Live eligibility + PII export
  "app/api/beneficiaries/[id]/verify-eligibility/route.ts",
  "app/api/user/data-export/route.ts",
  // PCI-scope card reveal endpoints
  "app/api/virtual-cards/[id]/reveal/route.ts",
  "app/api/virtual-cards/[id]/statement/route.ts",
  // Live Stripe / wire-transfer connector state
  "app/api/stripe/account-health/route.ts",
  "app/api/org/stripe-onboarding/route.ts",
  "app/api/org/stripe-account/route.ts",
  "app/api/org/link-bank/route.ts",
  "app/api/org/fund/route.ts",
  "app/api/org/fund/[transferId]/status/route.ts",
  // Live full-text search over Aurora indexes
  "app/api/search/route.ts",
  // Binary export (CSV/PDF) — not JSON-cacheable (FM-9)
  "app/api/reports/export/route.ts",
]);

const GET_HANDLER_RE = /^export\s+async\s+function\s+GET\b/m;
const CACHED_WITH_STALENESS_RE = /\bcachedWithStaleness\b/;

// ────────────────────────────────────────────────────────────────────
// Helpers
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

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────

function main() {
  let routes;
  try {
    routes = walkRoutes(API_ROOT).sort();
  } catch (err) {
    console.error(
      `[stale-cache-convention] fatal: failed to walk ${API_ROOT}:`,
      err.message,
    );
    process.exit(2);
  }

  const violations = [];
  let getRouteCount = 0;
  let exemptCount = 0;

  for (const route of routes) {
    let content;
    try {
      content = readFileSync(route, "utf8");
    } catch (err) {
      console.error(
        `[stale-cache-convention] fatal: failed to read ${route}:`,
        err.message,
      );
      process.exit(2);
    }

    if (!GET_HANDLER_RE.test(content)) continue; // not a GET route
    getRouteCount++;

    if (EXEMPTIONS.has(route)) {
      exemptCount++;
      continue;
    }

    if (!CACHED_WITH_STALENESS_RE.test(content)) {
      violations.push({
        route,
        hint:
          "GET route must wrap its Aurora fetch in cachedWithStaleness() " +
          "so degraded-mode requests serve a stale cached response with an " +
          "X-Data-Staleness header instead of 504-ing. Pattern established " +
          "in BSRS Ch 8 P2c Phase 1 (commit 33f583b); see lib/cache.ts for " +
          "the helper and docs/design-notes/bsrs-ch08-resilience-applied.md " +
          "§5 scorecard for the retrofit template and exemption policy.",
      });
    }
  }

  if (violations.length === 0) {
    console.log(
      `stale-cache-convention: pass (${getRouteCount} GET routes checked, ${exemptCount} exempt)`,
    );
    process.exit(0);
  }

  console.error(
    `stale-cache-convention: FAIL — ${violations.length} violation(s) in ${getRouteCount} GET routes checked`,
  );
  console.error("");
  for (const v of violations) {
    console.error(`  ${v.route}`);
    console.error(`    ${v.hint}`);
    console.error("");
  }
  console.error(
    "Fix guidance: docs/design-notes/bsrs-ch08-resilience-applied.md §5",
  );
  process.exit(1);
}

main();
