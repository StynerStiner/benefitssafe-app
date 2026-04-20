# Cloudflare Workers

Source of truth for the two Cloudflare Workers that front `benefits-safe-app`. The live Workers run on Cloudflare; the files in this directory are checked in for version control and change review. **Editing files here does not deploy anything** — after changing a Worker, the operator must push the change to Cloudflare (see "How to update" below).

## Workers

### `workers/benefitssafe-router.js` — traffic splitter

Fronts `benefitssafe.com` and splits requests between the stable and canary Vercel deployments (BSRS Ch 8 P3b).

- **10% canary / 90% stable** weighted random split on the first request (`Math.random() < 0.1`).
- **Session stickiness** via a `bs_channel` cookie (`HttpOnly; Secure; SameSite=Lax; Max-Age=86400`) so a user stays on one channel for the day.
- **System-route carve-out** — paths under `/api/webhooks/`, `/api/jobs/`, `/api/cron/`, `/api/events/` always route to `stable.benefitssafe.com` regardless of cookie or dice roll. This is what makes the Stripe webhook URL, QStash job callbacks, and the cron Worker's `/api/cron/*` invocations safe under the split.

**Disable switch (canary → 0%):** change the 0.1 literal to 0 and redeploy, or delete the Workers Route in the Cloudflare dashboard. See [`docs/runbooks/failure-domain-failover.md`](../docs/runbooks/failure-domain-failover.md) for the full rollback procedure.

### `workers/benefitssafe-cron.js` — scheduler

Replaces Vercel cron (Hobby plan blocks sub-daily schedules). Hits the app's cron endpoints on a cron-trigger schedule with a Bearer token that the endpoints validate via [`lib/cron-auth.ts`](../lib/cron-auth.ts).

Five schedules mirror what was previously in `vercel.json` (removed in commit `e3672d0`):

| Path | Cron |
|---|---|
| `/api/cron/revoke-expired-grants` | `0 * * * *` (hourly) |
| `/api/cron/sentinel` | `0 6 * * *` |
| `/api/cron/compliance` | `0 12 * * *` |
| `/api/cron/reports` | `0 7 * * 1` |
| `/api/cron/reconcile-orphan-stripe-cards` | `0 3 * * *` |

All requests go to the apex `https://benefitssafe.com` and are routed by the router Worker to `stable.benefitssafe.com` via the `/api/cron/*` carve-out.

`CRON_SECRET` is set as an encrypted Worker secret and must also be set on Vercel (Production + Preview) so both sides share the same value.

## How to update a Worker

1. Edit the `.js` file in this directory and commit.
2. Push the change live on Cloudflare:
   - **Dashboard path:** Cloudflare → Workers & Pages → select the Worker (`benefitssafe-router` or `benefitssafe-cron`) → Edit Code → paste file contents → Save and Deploy.
   - **CLI path (if wrangler is configured):** `wrangler deploy workers/<name>.js --name <name>` from this directory.
3. Verify:
   - Router: `curl -sI https://benefitssafe.com | grep -i set-cookie` (should see `bs_channel=...`).
   - Cron: Cloudflare → Workers → `benefitssafe-cron` → Logs — each scheduled invocation logs `[cron] <url> → <status>`.

## Related

- [`docs/design-notes/bsrs-ch08-p3-design.md`](../docs/design-notes/bsrs-ch08-p3-design.md) — P3 architecture, traffic-split rationale, carve-out design.
- [`docs/runbooks/failure-domain-failover.md`](../docs/runbooks/failure-domain-failover.md) — canary rollback procedure.
- [`docs/runbooks/canary-alert-rules.md`](../docs/runbooks/canary-alert-rules.md) — alert thresholds that trigger rollback.
- [`lib/cron-auth.ts`](../lib/cron-auth.ts) — Bearer-token validation on the cron endpoints.
