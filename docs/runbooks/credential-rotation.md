# Credential Rotation — Index Runbook

> BSRS Ch 8 P4. This is the index. Deep-dive procedures for specific
> credentials (Aurora master + scoped app role) live in their own
> runbook — see [aurora-credential-rotation.md](./aurora-credential-rotation.md).
> The append-only ledger is [credential-rotation-history.md](./credential-rotation-history.md).

Status: LIVE — applies from the commit that shipped P4.
Owner: adm.benefitssafe@gmail.com (AWS account owner).

---

## §1 — Why we rotate

*Time separation* (BSRS Ch 8 §"Blast radius controls") caps how long
a leaked credential remains dangerous. A Stripe key that leaked 18
months ago and has never been rotated is still valid today. A
quarterly rotation cadence is the cheapest resilience investment in
the chapter's P-inventory — no new infrastructure, no new dependency,
just a recurring calendar entry plus a measured process.

BenefitsSafe's reality: single-founder fintech-compliance platform,
pre-revenue, rotating a production Stripe key is higher stakes than
for a mature team with staging-to-prod parity. This runbook's job is
to make rotation a **known-quantity** operation rather than an
improvised scramble under breach pressure.

---

## §2 — Quarterly schedule

- **Cadence:** every 90 days (loosely quarterly). Batch the low-risk
  credentials first (CRON_SECRET, INTERNAL_API_KEY) before the high-
  blast-radius ones (STRIPE_SECRET_KEY, AUTH_SECRET).
- **Calendar reminders:** recurring entry in the account owner's
  personal calendar (Google/Apple). Reminder title:
  `BenefitsSafe credential rotation — Q<n> <YEAR>`. Link to this
  runbook in the description.
- **Next-due dates** (computed from 2026-04-17 baseline):
  - Q2 2026: rotation window 2026-07-15 → 2026-07-22
  - Q3 2026: rotation window 2026-10-14 → 2026-10-21
  - Q4 2026: rotation window 2027-01-13 → 2027-01-20
- **Grace:** the linter warns at 100 days, errors at 120, critical at
  180. Quarterly scheduling keeps every credential in the "ok" tier
  with ~25 days of buffer.

---

## §3 — How to record in the ledger

Every rotation produces two ledger artifacts: (1) a pair of Better
Stack log events, (2) a single row appended to the ledger markdown.

### Logger events

Run this in a one-off Node REPL or a scripts/ file during the
rotation itself (not after-the-fact — latency matters).

```ts
import {
  startRotation,
  completeRotation,
  failRotation,
} from "@/lib/credential-rotation-logger";

// BEFORE rotation begins:
const { rotation_id, started_at } = startRotation({
  credential_kind: "stripe_live_secret",   // see the 19-kind enum in the logger
  operator: "adm.benefitssafe@gmail.com",
  incident: "routine",                     // "routine" | "emergency" | "post_breach"
});
// Capture rotation_id and started_at for the completion call + ledger row.

// After successful rotation:
completeRotation({
  rotation_id,
  started_at,
  credential_kind: "stripe_live_secret",
  operator: "adm.benefitssafe@gmail.com",
  incident: "routine",
});

// OR — on failure:
failRotation({
  rotation_id,
  started_at,
  credential_kind: "stripe_live_secret",
  operator: "adm.benefitssafe@gmail.com",
  incident: "routine",
  error_summary: "short message — never paste the credential value",
});
```

### Ledger row

Append ONE row to [credential-rotation-history.md](./credential-rotation-history.md)
under the ledger table. Match the column order exactly:

```
| credential_kind | rotation_id | started_at | completed_at | latency_ms | operator | incident | notes |
```

`notes` should point at a deploy URL, incident ticket, or PR —
anything that gives the future reader the context without bloating the
row. Never paste the credential, the `.env` diff, or anything that
shouldn't outlive the rotation.

---

## §4 — Per-credential rotation procedures

All 19 tracked credentials. Shorter entries link out to the provider's
dashboard or an existing dedicated runbook.

### §4.1 Aurora — `aurora_master`, `aurora_app_role`

See the dedicated [aurora-credential-rotation.md](./aurora-credential-rotation.md)
for the full Phase 0-6 procedure. Expected latency: 30-60 minutes the
first time (cold runbook), ~10 minutes subsequent. Blast radius:
entire application — rotation done in a declared maintenance window.

### §4.2 Stripe — `stripe_live_secret`, `stripe_test_secret`

1. Sign into [https://dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys).
2. "Roll key" on the target secret. Stripe issues the new value and
   leaves the old one valid for 12 hours (dual-run window).
3. Update `STRIPE_SECRET_KEY` in Vercel Production (`vercel env rm` +
   `vercel env add`) and `.env.local`.
4. Deploy: `vercel --prod` (deploys are manual on this project — see
   project memory).
5. Smoke test: trigger a Stripe test event through the billing
   webhook; confirm it processes.
6. In Stripe dashboard, expire the old key (within the 12-hour
   window).

Expected latency: 15-25 minutes. Blast radius: all Stripe operations
(card issuance, billing checkout, webhooks).

### §4.3 Stripe webhooks — `stripe_webhook_primary`, `stripe_webhook_billing`, `stripe_webhook_charges`

Each webhook endpoint has its own signing secret. Rotate the same way
as §4.2 but per-endpoint; the dashboard surfaces "Roll secret" on
each endpoint's detail page. Expected latency: 10 minutes each.
Blast radius: the specific webhook flow (primary = general, billing =
subscription events, charges = Issuing transaction events).

### §4.4 AWS IAM — `aws_iam_deployer`

1. AWS Console → IAM → Users → benefitssafe-deployer (or whatever
   the deploy user is named in this account) → Security credentials.
2. "Create access key" — save the new pair.
3. Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in Vercel
   Production and `.env.local`.
4. Redeploy Vercel; verify S3 upload / Secrets Manager read via a
   test API call.
5. Delete the OLD access key in IAM console.

Expected latency: 10-15 minutes. Blast radius: all AWS operations
(S3, Secrets Manager, CloudWatch).

### §4.5 NextAuth — `auth_secret`

Rotating the JWT signing secret invalidates every active session.
Coordinate with a low-traffic window.

1. Generate: `openssl rand -base64 48`.
2. Update `AUTH_SECRET` and `NEXTAUTH_SECRET` in Vercel Production
   and `.env.local` (both names — legacy compat). Keep them in sync.
3. Deploy.
4. Expected user impact: all users re-authenticate. Post a banner
   ahead of time or rotate during overnight hours.

Expected latency: 15 minutes. Blast radius: every active user.

### §4.6 `encryption_key`

**Special case.** The encryption key is used to decrypt data at rest
(ssnLast4, other encrypted fields). Rotating it without a migration
step LEAKS data — every existing encrypted value will fail to
decrypt with the new key.

**Procedure is deferred.** Requires a dual-key decrypt → re-encrypt
migration. Track as a separate P-item if/when the threat model
demands rotation. The sentinel in the ledger stays in place; the
linter will eventually flip to critical at 180d — treat that as a
signal to escalate the migration PDR, not to rotate naively.

### §4.7 Low-blast-radius secrets

Same pattern: provider dashboard → generate new → update Vercel +
`.env.local` → redeploy → revoke old.

- `cron_secret` → regenerate with `openssl rand -base64 32`, update
  env, verify next hourly cron fires.
- `internal_api_key` → same pattern as `cron_secret`.
- `anthropic_api_key` → [console.anthropic.com](https://console.anthropic.com/).
- `composio_api_key` → [app.composio.dev](https://app.composio.dev/).
- `postmark_api_token` → Postmark dashboard.
- `sentry_auth_token` → [sentry.io](https://sentry.io/) → Settings → Auth Tokens.
- `upstash_redis_token` → Upstash console → Redis database → REST API.
- `qstash_token` + `qstash_signing_current` + `qstash_signing_next`
  → Upstash console → QStash → Signing keys. QStash's signing key
  rotation is a two-step (promote next → generate new next) — follow
  Upstash's docs.

Expected latency per credential: 5-10 minutes. Blast radius varies
(see each provider's docs; most are narrow — Postmark is just email,
Sentry is just error reporting, etc.).

---

## §5 — Emergency / post-breach rotation

If a credential is known-leaked (committed to git history, pasted
into chat, screenshot in an external doc), rotation is not optional
and the "routine" cadence doesn't apply.

1. Use `incident: "emergency"` or `incident: "post_breach"` on the
   logger call. The Better Stack event carries the flag and surfaces
   in alerts.
2. Aurora-specific: follow the "fallback path" in
   [aurora-credential-rotation.md](./aurora-credential-rotation.md)
   §Phase 3 if the old credential is already being blocked.
3. Skip dual-run windows. Revoke the old credential first, then
   issue + deploy the new one. User-visible downtime is the price of
   closing the exposure.
4. After the rotation, scrub any tracked docs that carried the old
   value (see [aurora-credential-rotation.md](./aurora-credential-rotation.md)
   §Phase 6).
5. Post-incident: decide whether the root cause (how the credential
   leaked) needs a separate PDR. If it leaked via git, install or
   verify gitleaks/detect-secrets pre-commit hook.

---

## §6 — Related

- [credential-rotation-history.md](./credential-rotation-history.md)
  — the ledger.
- [aurora-credential-rotation.md](./aurora-credential-rotation.md) —
  Aurora-specific deep dive.
- [lib/credential-rotation-logger.ts](../../lib/credential-rotation-logger.ts)
  — structured-log emitter.
- [scripts/lint/credential-freshness.mjs](../../scripts/lint/credential-freshness.mjs)
  — the linter that reads the ledger.
- [docs/design-notes/bsrs-ch08-resilience-applied.md](../design-notes/bsrs-ch08-resilience-applied.md)
  §P4 — the design context for this work.
