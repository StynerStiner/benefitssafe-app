# Credential Rotation History (Ledger)

> **Append-only.** Git history is the audit trail. Do NOT edit past rows;
> correct a bad entry by appending a new row with `incident = correction`
> and a note explaining the diff.

BSRS Ch 8 P4 introduced this ledger as the durable record of every
credential rotation. The linter at `scripts/lint/credential-freshness.mjs`
reads this file on every `npm run lint:conventions` to flag credentials
that haven't been rotated within the warn (100d) / error (120d) /
critical (180d) thresholds.

How to record a new rotation:
1. Before you start the rotation, call `startRotation(...)` from
   `lib/credential-rotation-logger` in a one-off script or REPL. Capture
   the returned `rotation_id` and `started_at`.
2. Perform the rotation per `docs/runbooks/credential-rotation.md` §4
   (per-credential procedures).
3. On success, call `completeRotation(...)` with the captured
   `rotation_id` + `started_at`. The logger emits the `latency_ms` to
   Better Stack.
4. Append one row to the table below. Columns must be in order. Keep
   `notes` concise — link to incident tickets, deploy URLs, or PRs
   rather than pasting context.

The ledger uses a single markdown table. Keep it that way — the linter
parser skips the header + separator and treats every `|`-prefixed row
as data.

## Baseline sentinel rows

Sentinel rows (created 2026-04-18 in commit that ships P4) mark each
credential as "in use since platform launch, never rotated." The
linter falls back to the sentinel only when no real rotation exists
for that `credential_kind`. Once you rotate a credential for real, the
sentinel is superseded — do not delete it, just append the new row
after it.

## Ledger

| credential_kind | rotation_id | started_at | completed_at | latency_ms | operator | incident | notes |
|---|---|---|---|---|---|---|---|
| aurora_master | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| aurora_app_role | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| stripe_live_secret | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| stripe_test_secret | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| stripe_webhook_primary | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| stripe_webhook_billing | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| stripe_webhook_charges | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| aws_iam_deployer | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| auth_secret | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| encryption_key | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| cron_secret | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| internal_api_key | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| anthropic_api_key | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| composio_api_key | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| postmark_api_token | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| sentry_auth_token | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| upstash_redis_token | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| qstash_token | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| qstash_signing_current | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
| qstash_signing_next | baseline | 2026-04-17T00:00:00Z | 2026-04-17T00:00:00Z | 0 | adm.benefitssafe@gmail.com | routine | Baseline sentinel — credential in use since platform launch, never rotated |
