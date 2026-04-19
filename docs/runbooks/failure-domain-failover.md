# Failure-Domain Failover Runbook

> BSRS Ch 8 P3e — step-by-step incident response for the two-failure-domain rollout. Use this runbook when a canary-vs-stable alert fires, a health probe fails, or a canary deploy is misbehaving.
>
> Companion to [`docs/design-notes/bsrs-ch08-p3-design.md`](../design-notes/bsrs-ch08-p3-design.md) §8 (where this runbook's structure is specified) and [`docs/runbooks/canary-alert-rules.md`](./canary-alert-rules.md) (the alerts that bring you here).

---

## 0. Required setup (one-time, per operator)

Before this runbook is executable end-to-end, confirm:

- `PROMOTE_PAT` secret is configured in the GitHub repo settings — a fine-grained PAT with `Contents: Read & Write` on this repo only. Rotation cadence: quarterly, tracked in `docs/runbooks/credential-rotation-history.md`.
- Branch protection is active on `stable` — only the `PROMOTE_PAT` identity can push. No other bypass, no admins, no direct push. Configured in GitHub UI (**Settings → Branches → Branch protection rules**).
- Cloudflare API token for Load Balancer weight changes is stored in 1Password under "BenefitsSafe — Cloudflare LB emergency" with the annotation "Emergency access — ops on-call." Token permissions: `Zone → Load Balancers → Edit` on `benefitssafe.com` only.
- Better Stack and Sentry dashboards follow [`canary-alert-rules.md`](./canary-alert-rules.md) — alert tier alerts are routed to email, page tier alerts are routed to phone/SMS.
- You have the Cloudflare `ACCOUNT_ID` and `LB_ID` values documented below (substituted after P3b provisioning):
  ```
  ACCOUNT_ID=<fill in after P3b>
  LB_ID=<fill in after P3b>
  POOL_CANARY_ID=<fill in after P3b>
  POOL_STABLE_ID=<fill in after P3b>
  ```

If any of the above is missing, fix it **now**, not during the incident.

---

## 1. Detect

An alert has fired. You got here because either:

- A Better Stack log alert paged you (Rule 1, 2, or 5 from [`canary-alert-rules.md`](./canary-alert-rules.md)).
- A Better Stack uptime probe failed (Rule 3).
- A Sentry issue alert fired on a canary-tagged release (Rule 4).
- A user, teammate, or external monitor reported something is broken.

**Checklist:**

- [ ] Open the Better Stack comparison dashboard ("BenefitsSafe — canary vs stable"). Check Panels A/B/F for the last 30 minutes.
- [ ] Filter the live log stream by `deploy_channel:"canary"` to see what canary is emitting right now.
- [ ] Filter again by `deploy_channel:"stable"` to compare. Is stable also unhealthy?
- [ ] Check Sentry → Releases → `bs@canary-*` for the newest release. Is there a burst of novel errors?
- [ ] Note the exact alert rule name and firing time. You'll need it for the postmortem.

If the comparison dashboard is unreachable (Better Stack itself is degraded), fall back to hitting the origins directly:
```
curl https://canary.benefitssafe.com/api/health
curl https://stable.benefitssafe.com/api/health
```
The JSON response includes `deploy_channel` + `commit_sha` — you can visually confirm which channel is serving and what commit.

---

## 2. Decide

Route the incident based on which channel is misbehaving.

### 2a. Canary-only problem (one signal on canary, stable looks normal)

Examples:
- Canary 5xx rate = 4%, stable 5xx rate = 0.3%.
- Canary p95 = 2.1s, stable p95 = 280ms.
- Canary health probe failing; stable health probe green.
- Sentry `bs@canary-<sha>` has 50 novel errors in 5 min; `bs@stable-<sha>` has 0.

**→ Go to §3 (rollback canary).** The canary deploy is broken; the best fix is to stop serving traffic from it.

### 2b. Shared-infra problem (both channels degraded)

Examples:
- Both channels reporting 5xx on every write (Aurora writer is down).
- Both channels' p95 doubled simultaneously (Redis or Stripe slowness).
- Both health probes failing with `checks.database.status = "down"`.

**→ Do NOT roll canary back.** Rolling back the canary won't fix a broken Aurora. Instead:

- Aurora incident → go to `docs/runbooks/aurora-incident-response.md` (or equivalent).
- Stripe incident → check [https://status.stripe.com](https://status.stripe.com). P1 Stripe circuit breaker ([lib/stripe-circuit.ts](../../lib/stripe-circuit.ts)) should already be protecting the app; verify `event:"stripe_circuit_open"` is firing in logs.
- Redis incident → check Upstash console. P2's `cachedWithStaleness` + `assertDbHealthy` should already be serving degraded-mode reads; verify stale responses are being returned.

### 2c. Ambiguous (can't tell if canary-specific or shared)

- Check request volume panel (Panel C). Is canary getting traffic? If not, the traffic-split wiring is broken — a separate P3b regression.
- Check Panel G (rollout watermark). Is the stable version the one you expected, or did a promotion happen unexpectedly?
- Compare Panels D and E between channels. If novel errors + circuit opens are heavily canary-skewed, treat as §2a.

When in doubt, **roll canary back**. You can always re-canary once you understand the incident. Leaving 10% of users bleeding while you investigate is worse than a brief all-stable window.

---

## 3. Rollback canary

Goal: set canary weight to 0 at the Cloudflare Load Balancer so 100% of traffic routes to stable. Target RTO: **< 2 minutes from decision to 100% stable traffic.**

### 3a. Flip weights via API

```bash
# Substitute the real values from "Required setup" above.
export CF_API_TOKEN="$(op read 'op://Shared/BenefitsSafe Cloudflare LB emergency/token')"
export ACCOUNT_ID="<fill in>"
export LB_ID="<fill in>"
export POOL_CANARY_ID="<fill in>"
export POOL_STABLE_ID="<fill in>"

curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/load_balancers/${LB_ID}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"default_pools\": [\"${POOL_STABLE_ID}\"],
    \"pop_pools\": {},
    \"country_pools\": {},
    \"region_pools\": {},
    \"steering_policy\": \"off\"
  }" | jq '.success, .errors'
```

Alternative: `"random_steering": {"pool_weights": {"${POOL_CANARY_ID}": 0, "${POOL_STABLE_ID}": 1}}` if the LB uses weighted random steering rather than default-pool fallback. Match whichever model P3b provisioned.

### 3b. Verify traffic shift

Wait ~30s for Cloudflare edge propagation, then:

```bash
for i in {1..10}; do
  curl -s https://benefitssafe.com/api/health | jq -r '.deploy_channel'
done
# Expected: 10 × "stable". Any "canary" means propagation incomplete or rule misconfigured.
```

### 3c. Confirm the fire is out

- Reopen the comparison dashboard. Verify the canary signal is flat (canary is receiving no traffic).
- Verify stable is handling the full load — Panel C stable series should be at ~100% of pre-incident request volume.
- Acknowledge the alert in Better Stack / PagerDuty.

### 3d. Post-rollback

Record the rollback in the deploy ledger (same ledger as `credential-rotation-history.md`-style), entry kind `"canary_rollback"`:

```json
{
  "event": "canary_rollback",
  "ts": "<ISO timestamp>",
  "operator": "<your github handle>",
  "canary_sha_rolled_back": "<the canary commit>",
  "stable_sha_during_rollback": "<the stable commit>",
  "trigger_alert": "<alert rule name>",
  "rto_seconds": "<decision-to-rolled-back duration>"
}
```

---

## 4. Investigate

The fire is out (100% traffic on stable). You now have time.

**The canary deployment itself is still up** — Cloudflare is just not sending traffic to it. You can hit `https://canary.benefitssafe.com` directly from your browser or curl for debugging without affecting users.

**Checklist:**

- [ ] Reproduce the failure against `canary.benefitssafe.com`. Capture exact request, response, and timing.
- [ ] Collect Sentry events: Sentry → Releases → `bs@canary-<sha>` → Issues. Export the stack traces and affected-user counts.
- [ ] Collect Better Stack logs for the incident window with filter `deploy_channel:"canary"`. Download as CSV if needed for postmortem analysis.
- [ ] Check if the canary version introduced a schema change. Compare `git diff stable..main -- prisma/` — any migrations? Were they expand-only (reversible) or contract (irreversible)?
- [ ] Identify root cause: buggy code, bad config, missing env var, dependency change, schema incompatibility, load spike on a newly-rewritten query?
- [ ] Draft postmortem in `docs/postmortems/<YYYY-MM-DD>-canary-<short-description>.md`. Template:
  - What happened (1 paragraph)
  - When (timestamps of detect, rollback, resolution)
  - Impact (% of users affected, duration, financial effect)
  - Root cause (technical, no blame)
  - Contributing factors
  - What went well
  - What went badly
  - Action items (owned, dated)

No blameless assumption is automatic — make it one.

---

## 5. Re-canary

You fixed the root cause. Two paths:

### 5a. Fix-forward (preferred)

New commit on `main` that resolves the root cause. Typical case: the canary code had a bug; you've fixed it.

1. Land the fix via a PR into `main` (normal review process — the 24hr burn-in is your safety net, not PR review).
2. Vercel's git integration auto-deploys new `main` → canary.
3. Canary weight stays at 0 until you're satisfied the fix is working. Monitor the canary-only signals — because canary is now receiving zero production traffic, you are relying on synthetic probes + your own manual testing. Consider a staging rehearsal before restoring traffic.
4. Restore canary weight to 0.1 via the same Cloudflare API (swap the payload to whatever P3b provisioned — 10% weight on canary).
5. **Restart the 24hr burn-in clock.** The new canary commit has a fresh timestamp; the promotion workflow ([.github/workflows/promote-canary-to-stable.yml](../../.github/workflows/promote-canary-to-stable.yml)) will enforce this automatically.

### 5b. Revert

The canary change is wrong and a fix isn't imminent. You want `main` to match `stable` again.

1. On `main`, create a revert commit for the bad canary change: `git revert <bad-sha>` and push. (Coordinate if other work has landed on main since.)
2. Vercel auto-deploys the reverted `main` → canary.
3. Confirm canary is now functionally identical to stable by checking `/api/health` on both.
4. Restore canary weight to 0.1.
5. 24hr burn-in starts fresh with the revert commit's timestamp.

### 5c. Schema-change emergency bypass

If the canary introduced a schema change that is not forward-compatible and cannot be reverted cleanly:

→ See [`docs/runbooks/expand-contract-migrations.md`](./expand-contract-migrations.md) §6 for the emergency bypass procedure (set canary weight 0, deploy migration + code straight to stable, restore canary only after main has caught up). Every bypass is recorded in the deploy ledger with reason.

---

## Appendix — quick-reference commands

### Check which channel is serving
```bash
curl -s https://benefitssafe.com/api/health | jq '{deploy_channel, commit_sha, status}'
```

### Hit a single channel directly (bypasses LB)
```bash
curl -s https://canary.benefitssafe.com/api/health
curl -s https://stable.benefitssafe.com/api/health
```

### Current canary and stable SHAs
```bash
git fetch origin
git log -1 --format="%h %s" origin/main    # canary
git log -1 --format="%h %s" origin/stable  # stable
```

### Sentry filter for canary-only errors
```
release:bs@canary-*
```

### Better Stack filter for canary-only logs
```
deploy_channel:"canary"
```

### Promotion workflow (24hr burn-in gate)
```bash
gh workflow run promote-canary-to-stable.yml \
  -f canary_sha="<full 40-char SHA>" \
  -f override_burn_in_reason=""  # non-empty bypasses the 24hr gate
```

---

## See also

- [`docs/design-notes/bsrs-ch08-p3-design.md`](../design-notes/bsrs-ch08-p3-design.md) — P3 design, §§6-8 cover monitoring, promotion, and failover rationale.
- [`docs/runbooks/canary-alert-rules.md`](./canary-alert-rules.md) — the alert rules that page you and bring you here.
- [`docs/runbooks/expand-contract-migrations.md`](./expand-contract-migrations.md) — schema-change discipline (and §6 emergency bypass).
- [`.github/workflows/promote-canary-to-stable.yml`](../../.github/workflows/promote-canary-to-stable.yml) — the promotion workflow this runbook references.
