#!/usr/bin/env node
// BSRS Ch 8 P4 — rotation-freshness linter.
//
// Reads docs/runbooks/credential-rotation-history.md, computes days-since-
// last-rotation for every credential_kind, and emits warn/error/critical
// findings. Baseline sentinel rows (notes column starts with "Baseline
// sentinel") are ignored when a real rotation exists; when only sentinel
// exists, the row is treated as "never rotated since launch" and falls
// into whichever tier the sentinel's own age pushes it into.
//
// Run:    node scripts/lint/credential-freshness.mjs           (warn-only, exit 0)
// Run:    node scripts/lint/credential-freshness.mjs --enforce (exit 1 at error, 2 at critical)
// Exit:   0 pass OR non-enforce default, 1 error threshold (--enforce),
//         2 critical threshold (--enforce) OR script error.
//
// Dependency: pure Node 22 stdlib only. Follows the shape of
// scripts/lint/auth-guard-convention.mjs so both linters run the same way.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

// ────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────

const LEDGER_PATH = "docs/runbooks/credential-rotation-history.md";
const SENTINEL_NOTES_PREFIX = "Baseline sentinel";

// Must stay in sync with CredentialKind in lib/credential-rotation-logger.ts.
// If you add a new credential kind to the logger, add it here AND add a
// baseline sentinel row to the ledger.
export const KNOWN_CREDENTIAL_KINDS = Object.freeze([
  "aurora_master",
  "aurora_app_role",
  "stripe_live_secret",
  "stripe_test_secret",
  "stripe_webhook_primary",
  "stripe_webhook_billing",
  "stripe_webhook_charges",
  "aws_iam_deployer",
  "auth_secret",
  "encryption_key",
  "cron_secret",
  "internal_api_key",
  "anthropic_api_key",
  "composio_api_key",
  "postmark_api_token",
  "sentry_auth_token",
  "upstash_redis_token",
  "qstash_token",
  "qstash_signing_current",
  "qstash_signing_next",
]);

export const THRESHOLD_WARN_DAYS = 100;
export const THRESHOLD_ERROR_DAYS = 120;
export const THRESHOLD_CRITICAL_DAYS = 180;

// ────────────────────────────────────────────────────────────────────
// ANSI — matches scripts/lint/auth-guard-convention.mjs
// ────────────────────────────────────────────────────────────────────

const color = {
  reset: "\x1b[0m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  brightRed: "\x1b[91m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
};

// ────────────────────────────────────────────────────────────────────
// Pure helpers (exported for unit tests)
// ────────────────────────────────────────────────────────────────────

/**
 * Classify a single credential's freshness.
 *
 * @param {string} credentialKind
 * @param {Date|null} latestCompletedAt — latest non-sentinel rotation, or
 *   the sentinel row's completed_at if no real rotation exists, or null
 *   if the credential is missing from the ledger entirely.
 * @param {Date} now
 * @returns {{ tier: "ok"|"warn"|"error"|"critical", days: number|null, reason: string }}
 */
export function classifyCredential(credentialKind, latestCompletedAt, now) {
  if (latestCompletedAt === null) {
    return {
      tier: "critical",
      days: null,
      reason: `missing from ledger — add a baseline sentinel row for ${credentialKind}`,
    };
  }
  const ageMs = now.getTime() - latestCompletedAt.getTime();
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (days >= THRESHOLD_CRITICAL_DAYS) {
    return { tier: "critical", days, reason: `${days} days since last rotation` };
  }
  if (days >= THRESHOLD_ERROR_DAYS) {
    return { tier: "error", days, reason: `${days} days since last rotation` };
  }
  if (days >= THRESHOLD_WARN_DAYS) {
    return { tier: "warn", days, reason: `${days} days since last rotation` };
  }
  return { tier: "ok", days, reason: `${days} days since last rotation` };
}

/**
 * Parse the markdown ledger into a map of credential_kind →
 * latest-completed_at Date. Sentinel rows count only when no real
 * rotation exists for that kind.
 *
 * @param {string} markdown — full file contents.
 * @returns {Map<string, Date>}
 */
export function parseLedger(markdown) {
  const realLatest = new Map();
  const sentinelLatest = new Map();

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) continue;
    // Skip separator rows (|---|---|).
    const cells = line
      .split("|")
      .slice(1, -1) // drop empty cells from leading/trailing |
      .map((c) => c.trim());
    if (cells.length < 8) continue;
    if (cells.every((c) => /^-+$/.test(c))) continue;
    if (cells[0] === "credential_kind") continue; // header row

    const [credential_kind, , , completed_at, , , , notes] = cells;
    if (!credential_kind || !completed_at) continue;
    const parsed = new Date(completed_at);
    if (Number.isNaN(parsed.getTime())) continue;

    const bucket = notes?.startsWith(SENTINEL_NOTES_PREFIX)
      ? sentinelLatest
      : realLatest;
    const prev = bucket.get(credential_kind);
    if (!prev || parsed > prev) bucket.set(credential_kind, parsed);
  }

  const merged = new Map();
  for (const kind of KNOWN_CREDENTIAL_KINDS) {
    const real = realLatest.get(kind);
    if (real) merged.set(kind, real);
    else if (sentinelLatest.has(kind)) merged.set(kind, sentinelLatest.get(kind));
  }
  return merged;
}

// ────────────────────────────────────────────────────────────────────
// CLI entry point
// ────────────────────────────────────────────────────────────────────

function main() {
  const enforce = process.argv.includes("--enforce");
  const now = new Date();

  let markdown;
  try {
    markdown = readFileSync(LEDGER_PATH, "utf8");
  } catch (err) {
    console.error(
      `${color.red}credential-freshness: cannot read ${LEDGER_PATH} — ${err.message}${color.reset}`,
    );
    process.exit(2);
  }

  const ledger = parseLedger(markdown);

  const results = KNOWN_CREDENTIAL_KINDS.map((kind) => {
    const latest = ledger.get(kind) ?? null;
    const classification = classifyCredential(kind, latest, now);
    return { kind, ...classification };
  });

  const tally = { ok: 0, warn: 0, error: 0, critical: 0 };
  for (const r of results) tally[r.tier]++;

  for (const r of results) {
    if (r.tier === "ok") continue;
    const tint =
      r.tier === "critical"
        ? color.brightRed
        : r.tier === "error"
          ? color.red
          : color.yellow;
    console.error(
      `${tint}[${r.tier.toUpperCase()}] ${r.kind} — ${r.reason}${color.reset}`,
    );
  }

  console.log("");
  console.log(
    `credential-freshness: ${color.green}${tally.ok} ok${color.reset}, ` +
      `${color.yellow}${tally.warn} warn${color.reset}, ` +
      `${color.red}${tally.error} error${color.reset}, ` +
      `${color.brightRed}${tally.critical} critical${color.reset} ` +
      `(${results.length} tracked credential kinds)`,
  );
  console.log(
    `${color.gray}  ledger: ${LEDGER_PATH}${color.reset}`,
  );
  console.log(
    `${color.gray}  thresholds: warn=${THRESHOLD_WARN_DAYS}d, error=${THRESHOLD_ERROR_DAYS}d, critical=${THRESHOLD_CRITICAL_DAYS}d${color.reset}`,
  );

  if (!enforce) {
    console.log(
      `${color.gray}  mode: warn-only (pass --enforce to block on error/critical)${color.reset}`,
    );
    process.exit(0);
  }

  if (tally.critical > 0) process.exit(2);
  if (tally.error > 0) process.exit(1);
  process.exit(0);
}

// Only run main() when this file is executed directly, not when imported
// by the vitest tests.
const thisFile = fileURLToPath(import.meta.url);
const scriptFile = process.argv[1] ? join(dirname(process.argv[1]), "") : "";
if (thisFile === process.argv[1] || thisFile.endsWith(process.argv[1] ?? "")) {
  main();
}
