#!/usr/bin/env node
// BSRS Ch 8 P2b — db-health convention linter.
//
// Enforces the pattern introduced in BSRS Ch 8 P2a (commit f9e4c43) and
// rolled out across Tier 1 (bef76ec), Tier 2 (cdf1218), and Tier 3
// (8aaf366): every write route under app/api/ must gate its try{} on
// `assertDbHealthy()` so Aurora unavailability short-circuits to 503 +
// Retry-After instead of consuming a Vercel function slot during an
// incident.
//
// Run:    node scripts/lint/db-health-convention.mjs
// Exit:   0 = pass, 1 = violations found, 2 = script error
//
// Rule — Every route.ts under app/api/ that exports POST/PUT/PATCH/DELETE
//        must either (a) reference `assertDbHealthy` somewhere in the
//        file, OR (b) appear in the EXEMPTIONS set below.
//
// Exemption categories (15 routes total), each exempt for a specific
// reason that makes the DB gate redundant or unhelpful:
//
//   webhooks (4) — Stripe retries 5xx with exponential backoff;
//     handlers are idempotent via ProcessedWebhookEvent. A 503 from the
//     gate converts to a Stripe-side retry with identical net effect.
//
//   auth (6) — the handler must already talk to Aurora to do anything
//     useful; an Aurora outage returns a natural Prisma error, which
//     the existing catch maps to 5xx. Adding assertDbHealthy produces
//     two different 503 shapes for the same failure.
//
//   QStash jobs (5) — upstream retry + DLQ semantics already handle
//     transient Aurora unavailability. A 503 here triggers the
//     scheduled-retry path, which is the desired behavior anyway.
//
// Matching: exact relative-path equality against a Set. Directory-prefix
// matching (e.g., startsWith("app/api/webhooks/")) is rejected here so
// a future non-exempt route added under one of these directories
// cannot slip through the gate by accident.
//
// Companion to scripts/lint/auth-guard-convention.mjs (P4.3) and
// scripts/lint/credential-freshness.mjs (P4). Same invocation shape.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────

const API_ROOT = "app/api";

const EXEMPTIONS = new Set([
  // Webhooks — Stripe signature verification + ProcessedWebhookEvent idempotency
  "app/api/webhooks/stripe/route.ts",
  "app/api/webhooks/stripe/fraud/route.ts",
  "app/api/webhooks/stripe-charges/route.ts",
  "app/api/webhooks/stripe-billing/route.ts",
  // Auth — NextAuth password + email flows; natural Aurora failure path
  "app/api/auth/register/route.ts",
  "app/api/auth/accept-invite/route.ts",
  "app/api/auth/forgot-password/route.ts",
  "app/api/auth/reset-password/route.ts",
  "app/api/auth/record-login/route.ts",
  "app/api/auth/resend-verification/route.ts",
  // QStash jobs — upstream retry + DLQ semantics
  "app/api/jobs/process-charge/route.ts",
  "app/api/jobs/run-compliance/route.ts",
  "app/api/jobs/send-notification/route.ts",
  "app/api/jobs/generate-report/route.ts",
  "app/api/jobs/check-thresholds/route.ts",
]);

const WRITE_HANDLER_RE =
  /^export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/m;
const ASSERT_DB_HEALTHY_RE = /\bassertDbHealthy\b/;

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
      `[db-health-convention] fatal: failed to walk ${API_ROOT}:`,
      err.message,
    );
    process.exit(2);
  }

  const violations = [];
  let writeRouteCount = 0;
  let exemptCount = 0;

  for (const route of routes) {
    let content;
    try {
      content = readFileSync(route, "utf8");
    } catch (err) {
      console.error(
        `[db-health-convention] fatal: failed to read ${route}:`,
        err.message,
      );
      process.exit(2);
    }

    if (!WRITE_HANDLER_RE.test(content)) continue; // not a write route
    writeRouteCount++;

    if (EXEMPTIONS.has(route)) {
      exemptCount++;
      continue;
    }

    if (!ASSERT_DB_HEALTHY_RE.test(content)) {
      violations.push({
        route,
        hint:
          "Write route must call assertDbHealthy() at the top of each " +
          "try{} and map DbUnavailableError → 503 in the catch. Pattern " +
          "established in BSRS Ch 8 P2a (commit f9e4c43); see " +
          "docs/design-notes/bsrs-ch08-p2b-retrofit-catalog.md for the " +
          "retrofit template and exemption policy.",
      });
    }
  }

  if (violations.length === 0) {
    console.log(
      `db-health-convention: pass (${writeRouteCount} write routes checked, ${exemptCount} exempt)`,
    );
    process.exit(0);
  }

  console.error(
    `db-health-convention: FAIL — ${violations.length} violation(s) in ${writeRouteCount} write routes checked`,
  );
  console.error("");
  for (const v of violations) {
    console.error(`  ${v.route}`);
    console.error(`    ${v.hint}`);
    console.error("");
  }
  console.error(
    "Fix guidance: docs/design-notes/bsrs-ch08-p2b-retrofit-catalog.md",
  );
  process.exit(1);
}

main();
