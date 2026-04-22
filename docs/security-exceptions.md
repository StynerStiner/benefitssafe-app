# Security Exceptions

Known vulnerabilities accepted with documented justification.
Review quarterly. Remove entries when upstream patches ship.

Last reviewed: 2026-04-22

---

## Prisma 7 dev-server chain (4 moderate)

**Packages:** `prisma`, `@prisma/dev`, `@hono/node-server`, `hono`

**Advisories:**
- `@hono/node-server`: middleware bypass via repeated slashes on static file serving
- `hono`: improperly handles JSX attribute names, allowing HTML injection in `h()`

**Attack surface analysis:**
The `@prisma/dev` package is bundled into Prisma 7's dev-server for interactive migration workflows. It runs a local HTTP server (powered by hono + @hono/node-server) when a developer executes `prisma migrate dev` on their laptop. This dev server binds to localhost and is used only for interactive schema migration authoring.

**Exploitability assessment — NOT REACHABLE in production because:**
- Production builds use `prisma migrate deploy` (non-interactive, no dev server)
- Production runtime uses `@prisma/client` only — `@prisma/dev` is not loaded
- No hono server runs on Vercel production or the Aurora database
- The attack surface is a localhost-bound HTTP server on developer machines

**Mitigation in place:**
- Developer machines sit behind personal firewalls
- `prisma migrate dev` is only run on schema changes, not during normal dev workflow
- No sensitive production data is copied to developer laptops (dev uses seeded data)
- `.npmrc` has `ignore-scripts=true` — `postinstall` prisma generate is blocked on install; build explicitly re-runs it in a controlled pipeline

**Remediation path:**
- **Preferred:** Wait for a patched Prisma 7.5.x release that bumps `@prisma/dev` to a fixed hono version
- **Fallback:** Downgrade to `prisma@6.19.3` (major regression — not cost-justified currently)

**Monitor:** https://github.com/prisma/prisma/releases for a patched 7.5.x tag.

---

## NextAuth v5 beta (0 current vulns, version risk)

**Package:** `next-auth@5.0.0-beta.29`

**Why on beta:**
NextAuth v5 API stabilization ahead of stable release. v4 had limitations we chose to leave behind (App Router integration, edge runtime support).

**Risk profile:**
No current security vulnerabilities. Betas can introduce breaking API changes between releases, which could force emergency migration work.

**Mitigation:**
- Exact version pinned in package.json (no `^` range)
- Plan: migrate to v5 stable within 30 days of the stable release announcement

**Monitor:** https://github.com/nextauthjs/next-auth/releases

---

## Stripe SDK 14.x (0 current vulns, 3 majors behind)

**Package:** `stripe@^14.0.0` (current upstream: 17.x)

**Why behind:**
Stripe major versions have API surface changes requiring migration work. Deferred until a dedicated upgrade sprint.

**Risk profile:**
No security vulnerabilities in 14.x at time of this review. API features from 15/16/17 not accessible until upgrade.

**Mitigation:**
- Webhook signatures verified via Ed25519 in `app/api/webhooks/stripe/**`
- Server-side only; no client-side secret exposure
- Separate webhook secrets per endpoint (legacy, billing, charges)

**Remediation path:**
Schedule a Stripe SDK upgrade sprint `14 → 17` as its own project. Read migration guides for each major individually. Test each major bump on a Vercel preview deploy before promoting.

**Monitor:** https://github.com/stripe/stripe-node/releases

---

## uuid advisory — not triggered (documented for auditor clarity)

**Package:** `uuid`

**Advisory:** GHSA on v3/v5/v6 when `buf` argument is provided (buffer bounds check missing).

**Why not triggered:**
Our only usage is `v4()` with no arguments in [lib/s3-upload.ts](../lib/s3-upload.ts). v3/v5/v6 are namespace-based variants we don't use. No `buf` argument is ever passed anywhere.

**Note:** uuid will still be upgraded to v14 in Tier 1 for hygiene, even though the vuln isn't on our code path.
