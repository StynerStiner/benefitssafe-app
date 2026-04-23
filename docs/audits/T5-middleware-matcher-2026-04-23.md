# T5 — middleware.ts matcher regex fix (OQ-1 closeout)

**Date:** 2026-04-23
**Scope:** one-line regex change + one-line array cleanup in [middleware.ts](../../middleware.ts) so that root-served `/public` assets bypass the auth + trial + role + fingerprint + BetterStack middleware stack as originally intended.
**Prerequisites:** [docs/CTM-BASELINE.md](../CTM-BASELINE.md) (§3 Crown Jewels, §4 Trust Boundaries, §6 OQ-1).
**Related memory:** `project_t5_candidate_middleware_matcher.md`.
**Closes:** OQ-1.
**Rule #14 posture:** code + PDR + OQ close + DEPENDENCY_AUDIT row.

---

## §1 Problem

[middleware.ts:229](../../middleware.ts#L229) negative-lookahead matcher includes `public/`:

```ts
matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest|public/).*)"]
```

Next.js serves files in `/public` at **URL root** — `public/maps/foo.json` is served at `/maps/foo.json`, not `/public/maps/foo.json`. The `public/` lookahead therefore never fires, and every root-served static asset (T4's `/maps/countries-110m.json` on 7 dashboard pages, every `/assets/images/*.png`, `/full-logos/*.png`, `/robots.txt`, `/sitemap.xml`) currently transits the full middleware stack:

- BetterStack log write (prod cost + log noise)
- NextAuth JWT decode (cookie parse + Web-Crypto HMAC verify)
- Trial / subscription JWT-claim check
- Role → route-permission table lookup
- Session-fingerprint Web-Crypto SHA-256 hash on every hit

The same dead-code bug is duplicated at [middleware.ts:18](../../middleware.ts#L18) — `"/public"` is listed in `PUBLIC_PATHS`, and `isPublicPath` uses `startsWith`, so a request pathname of `/maps/countries-110m.json` never short-circuits via that route either.

---

## §2 /public audit (authorization pre-flight)

All contents of [public/](../../public) catalogued and assessed for authorization sensitivity:

| Path | Contents | Auth concern? | References at URL root |
|------|----------|:--------------:|------------------------|
| `assets/` | 400+ WowDash template images + 3 vendor `*.txt` files containing font-download URLs and purchase instructions (no PII, no secrets) | No | 7 (6 in [app/(dashboard)/org-settings/page.tsx:124-129](../../app/(dashboard)/org-settings/page.tsx#L124-L129), 1 in [components/ai/compliance-chat.tsx:28](../../components/ai/compliance-chat.tsx#L28)) |
| `full-logos/` | 9 PNG logos | No | Template imagery |
| `maps/` | `countries-110m.json` (world topology, vendored from world-atlas@2) | No | [components/charts/world-map-chart.tsx:20](../../components/charts/world-map-chart.tsx#L20) |
| `sitemap.xml` | Single placeholder URL (stale `benefitssafe.example.com` — separate nit, not in scope) | No | Public by convention |
| `robots.txt` | `User-agent: * / Disallow: /` (intentional — dashboard app must not be indexed) | No | Public by convention |
| `icons8-microsoft-48.png` (root-level) | Single icon | No | Already covered by existing `icon` prefix in matcher |

**Route-collision check:** no `app/maps/`, `app/assets/`, or `app/full-logos/` App Router segment exists. Widening the matcher exclusion cannot create an auth-bypass surface on any authenticated route.

**Conclusion:** safe to widen the exclusion. No file in `/public` requires middleware gating; all are world-readable by Next.js static serving regardless of whether the matcher runs.

---

## §3 Fix

[middleware.ts:229](../../middleware.ts#L229):

```diff
- matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest|public/).*)"]
+ matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest|assets/|full-logos/|maps/|robots\\.txt|sitemap\\.xml).*)"]
```

- **Removes** dead `public/` (never matched any real request).
- **Adds** the four real URL-root static subdirectories + two root files served from `/public`.
- **Does not add** `icons8-microsoft-48.png` — already covered by existing `icon` prefix.

[middleware.ts:18](../../middleware.ts#L18) `PUBLIC_PATHS`: remove dead `"/public"` entry (same root cause; nothing outside the `isPublicPath` array still references it).

---

## §4 Documented Failure Modes

### STRIDE

- **S (Spoofing).** Files under `/public` are already world-readable via Next.js static serving; no session identity was ever required to fetch them. The matcher exclusion changes nothing an attacker can reach. **No new surface.**
- **T (Tampering).** Read-only static assets. Middleware never wrote to them and can't prevent tampering (that lives at the file-system / deploy-pipeline layer). **No change.**
- **R (Repudiation).** BetterStack will no longer log these hits. For assets with no authentication gate, the audit-trail value is near-zero — the rows were cost + noise. Intentional tradeoff: reduced log volume, zero loss of forensically useful signal (no privilege action occurs on these fetches).
- **I (Information disclosure).** `/public` audit in §2 confirms no file contains PII, secrets, credentials, or org-scoped data. `robots.txt` is `Disallow: /` by design; `sitemap.xml` has a placeholder URL only. **No disclosure risk.**
- **D (Denial of service).** Net-positive: removes per-request JWT decode + Web-Crypto SHA-256 + BetterStack write for every asset fetch. Under dashboard load (7 icons per page × N concurrent users) this is measurable CPU and log I/O savings.
- **E (Elevation of privilege).** Middleware never grants privilege to static-asset fetches — the code path just returns `NextResponse.next()` after the fingerprint step. Skipping it does not elevate anything. **No change.**

### LINDDUN

- **L (Linkability).** Removing session-cookie ↔ asset-URL pairs from BetterStack retained logs *reduces* linkability. Net positive.
- **I (Identifiability).** Same direction as L — fewer retained identifying tuples. Net positive.
- **N (Non-repudiation — privacy sense).** Same as STRIDE-R — acceptable.
- **D (Detectability).** Next.js static serving reveals file presence whether the matcher runs or not; detectability surface unchanged.
- **D (Disclosure of information).** Covered in STRIDE-I — audit confirmed no sensitive content.
- **U (Unawareness).** Users are not tracked by `/public` asset fetches in any meaningful way; no consent surface implicated.
- **N (Non-compliance).** No regulation requires middleware to run on world-readable template imagery. **N/A.**

### CTM-BASELINE mapping

- **CJ-8 (organizationId scoping invariant):** zero impact. Org scoping is enforced at the **Prisma layer** in [lib/prisma.ts](../../lib/prisma.ts) middleware, not in `middleware.ts`. No data-scoping path runs inside the edge middleware for static assets or otherwise.
- **TB-1 (external web ↔ app trust boundary):** this PDR **widens the pre-auth allowlist** at this boundary. Crossing rule before: every request is authenticated or redirected (except `_next/*`, `favicon.ico`, `icon*`, `apple-icon*`, `manifest*`). Crossing rule after: above, plus `/assets/*`, `/full-logos/*`, `/maps/*`, `/robots.txt`, `/sitemap.xml`. The widening is defensible because the files on the inside of the boundary are served with no access control regardless of whether middleware runs — the matcher was doing theatre, not enforcement.
- No new Crown Jewel, trust boundary, external service, DB, or role introduced. No append to CTM-BASELINE §3–5 required.

---

## §5 Validation

### V-1 — Local build (P-1 gate)

`npm run build` → green. No new errors. Warnings unchanged from baseline (pre-existing Sentry deprecation + Next.js workspace inference). Middleware bundle: 107 kB (no delta vs. before — logic unchanged; only the matcher string changed).

### V-2 — Build-log grep (P-2 gate)

`grep -Ei "CSP|jsdelivr|ERESOLVE" /tmp/t5-build.log` → no matches. `grep -Ei "error|warning"` shows only pre-existing deprecation warnings.

### V-3 — Dev-server auth-gate curl tests

| # | URL | Expected | Actual |
|---|-----|---------|--------|
| 1 | `GET /maps/countries-110m.json` (unauthenticated) | 200 | **200** |
| 2 | `GET /api/beneficiaries` (unauthenticated) | 307 → `/auth/login` | **307** |
| 3 | `GET /dashboard` (unauthenticated) | 307 → `/auth/login` | **307** |
| 4 | `GET /assets/images/Compliance-Assistant-icon/icon-only.png` (unauthenticated) | 200 | **200** |
| 5 | `GET /robots.txt` (unauthenticated) | 200 | **200** |
| 6 | `GET /sitemap.xml` (unauthenticated) | 200 | **200** |

Tests 1/4/5/6 confirm the matcher exclusion routes asset requests straight to Next's static file handler — bypassing middleware. Tests 2/3 confirm auth gating on dynamic routes is untouched.

### V-4 — Middleware-invocation evidence

Dev log `grep -i middleware /tmp/t5-dev.log` showed only the `Compiled /middleware in 668ms` compile line; zero runtime log lines for tests 1/4/5/6 — middleware function did not execute.

### V-5 — Bundle delta

Middleware 107 kB unchanged. Per-route First Load JS values unchanged. Bundle-delta target: 0. **Met.**

### V-6 — Preview gate (on push)

Vercel preview deploy from feature branch `t5/middleware-matcher-public-fix` builds with `CSP|jsdelivr|ERESOLVE|middleware` grep clean.

### 7.7 (user-driven) — deferred to user

Load any WorldMapChart page on `app.benefitssafe.com`, verify `GET /maps/countries-110m.json` → 200 **and** that the request is absent from the BetterStack stream for middleware source.

---

## §6 OQ-1 closeout

On merge, [docs/CTM-BASELINE.md §6](../CTM-BASELINE.md) OQ-1 row marked **CLOSED** with the merge SHA.

## §7 DEPENDENCY_AUDIT row

Appended post-merge via the SHA-paradox two-commit pattern documented in [CLAUDE.md → CTM step 5](../../CLAUDE.md). Row classification: `misconfig`, `prod`, `fix`.
