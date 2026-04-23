# DEPENDENCY_AUDIT.md — Security Decision Log

**Append-only.** Every PDR that remediates, defers, or accepts a dependency vulnerability or a security-relevant misconfiguration appends a row after merge. Prior rows are never edited — new information appends as a follow-up row with a later date.

## When to append a row

- `npm audit` or a GHSA advisory flags a package in the dependency graph (direct or transitive)
- A security-adjacent misconfiguration is discovered and fixed (CSP, CORS, auth headers, middleware matcher, etc.)
- A previously-accepted exception changes state (upstream patch released, new exploit surface, reachability analysis updated)

## Columns

| Column | Meaning |
|--------|---------|
| **Date** | ISO date of the merge that closed the decision |
| **Package** | Affected package(s) or subsystem; for misconfigs, describe the surface |
| **Severity (CVSS + source)** | Severity label (High/Moderate/Low) + authoritative source (GHSA ID, CVE, or `misconfig`); CVSS when available |
| **Prod/Dev** | `prod` · `dev-only` · `build-only` — determines zero-tolerance vs. exception-path eligibility per `CLAUDE.md → Security Standard` |
| **Exploitable** | `Y`/`N` + one-line reachability analysis (which code path, who can reach it, what preconditions) |
| **Decision** | `fix` · `defer` · `accept` — `defer` requires a next-check date; `accept` requires a matching entry in `docs/security-exceptions.md` |
| **Fix version / override** | Specific remediation: override pin, version bump, self-host, config change, or exception pointer |
| **Verification status** | PDR validation gates that passed (V-1…V-N, P-1/P-2, 7.7, etc.) |
| **Deploy SHA** | Production merge SHA that shipped the decision, or `n/a` for pure-accept rows |

## Log

| Date | Package | Severity (CVSS + source) | Prod/Dev | Exploitable | Decision | Fix version / override | Verification status | Deploy SHA |
|------|---------|--------------------------|----------|-------------|----------|------------------------|----------------------|------------|
| 2026-04-22 | `d3-color` | High — GHSA-36jr-mh4h-2g58 (ReDoS) | prod | **Y** — in bundle via `react-simple-maps` chain on 7 dashboard pages (beneficiaries, my-dashboard, policies, subscriptions, audit-trail, vendor-dashboard, reports) | fix | `overrides.d3-color >=3.1.0` in `package.json` | V-1–V-6 + 7.7 passed | `52836c8` |
| 2026-04-22 | Prisma dev-server chain (`@hono/node-server` → `@prisma/dev` → `prisma`) | Moderate ×3 | dev-only | **N** — `prisma migrate deploy` on Vercel does not load `@prisma/dev`; localhost-only | accept | documented in `docs/security-exceptions.md` | monitoring for Prisma 7.5.x patched release | n/a |
| 2026-04-23 | `cdn.jsdelivr.net` CSP misconfig — blocked `WorldMapChart` topojson | N/A (misconfig, not CVE) | prod | **Y** — maps blank on 7 dashboard pages since pre-T2 | fix | self-host `/maps/countries-110m.json` in `/public`; no CSP change | V-1–V-6 + P-1/P-2 preview gate passed | `3e58336` |
