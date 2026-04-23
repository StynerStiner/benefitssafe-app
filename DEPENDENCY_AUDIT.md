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
| 2026-04-23 | `/api/user/data-export` (D-1 shipped) | Critical — LINDDUN-D (CCPA §1798.110 + GDPR Art. 15) | prod | **Y** — legitimate user exercising right-to-know receives only 6 of 11+ user-referencing tables | fix | Extended `Promise.all` with `OrganizationMembership` + `InviteToken` + `Approval` + `Notification` + `CardholderEligibility`; conservative field selection excludes free-text fields that may embed cross-user PII | code fix + audit-only | `d3682fd` |
| 2026-04-23 | `/api/user/data-export` (D-1 defer → Message/Conversation) | Critical — LINDDUN-D (GDPR Art. 15) | prod | **Y** — conversations + messages the user participates in are not exported | defer | audit-only — policy decision required (sender-only scope vs all-participants scope) | audit-only | n/a — audit-only, see OQ-15 |
| 2026-04-23 | `/api/user/data-export` (D-1 defer → AuditLog cap) | High — LINDDUN-D (GDPR Art. 15) | prod | **Y** — 100-row cap truncates audit history; GDPR expects full record | defer | audit-only — needs pagination + performance plan (users may have 10M+ audit rows at scale) | audit-only | n/a — audit-only, see OQ-16 |
| 2026-04-23 | `/api/user/data-export` (D-1 defer → Transaction JOIN) | Medium — LINDDUN-D (GDPR Art. 15) | prod | **Y** — `Transaction` rows on the user's cards not exported | defer | audit-only — requires `VirtualCard.beneficiaryId` JOIN + field-selection policy (20+ lines) | audit-only | n/a — audit-only, see OQ-17 |
| 2026-04-23 | `/api/user/data-deletion` (N-1 self-service AuditLog scrub) | High — LINDDUN-N (CCPA §1798.105 + GDPR Art. 17) | prod | **Y** — beneficiary-initiated deletion leaves PII in `AuditLog.oldValue` / `newValue` JSON indefinitely; admin route already handles this | defer | audit-only — needs shared `lib/data-deletion.ts` helper extracted from admin route so both paths stay in sync | audit-only | n/a — audit-only, see OQ-18 |
| 2026-04-23 | `Message` / `Conversation` models (N-2) | Medium — LINDDUN-N (CCPA §1798.105 + GDPR Art. 17) | prod | **Y** — `Message.content` + `Conversation.title` not anonymized on user deletion | defer | audit-only — policy decision required (anonymize vs soft-delete vs preserve for other participants) | audit-only | n/a — audit-only, see OQ-19 |
| 2026-04-23 | `/api/user/data-deletion` (N-4 verification) | Medium — LINDDUN-N (CCPA §1798.130(a)(2) + GDPR Art. 12(6)) | prod | **Y** — single authenticated `POST` irreversibly anonymizes account with no email confirmation or cooling-off | defer | audit-only — needs email-confirmation token flow + cooling-off UI | audit-only | n/a — audit-only, see OQ-20 |
| 2026-04-23 | `AuditLog model` (Nnr-1 IP/UA retention) | Low — LINDDUN-N (GDPR Art. 5(1)(c) minimization) | prod | **Y** — `ipAddress` + `userAgent` retained indefinitely on every audit row | defer | audit-only — needs action-taxonomy review + per-action TTL policy; tension vs GDPR Recital 49 (fraud detection legitimate interest) | audit-only | n/a — audit-only, see OQ-21 |
| 2026-04-23 | `AuditLog model` (Nnr-2 retention policy) | Low — LINDDUN-N (GDPR Art. 5(1)(e) storage limitation) | prod | **N** — documented as "indefinitely (compliance requirement)" in `docs/cascade-behavior.md:73`, defensible basis; gap is the lack of explicit regulatory anchor | defer | audit-only — needs retention policy tied to SOX/IRS §501(c)(3) anchors + cron or table-partitioning enforcement | audit-only | n/a — audit-only, see OQ-22 |
| 2026-04-23 | `middleware.ts` matcher regex — T5 (OQ-1 closeout) | N/A (misconfig, not CVE) | prod | **N** — dead-code `public/` lookahead never matched a real request path (Next serves `/public/*` at URL root); every root-served static-asset fetch has been transiting the full auth + trial + role + fingerprint + BetterStack middleware stack unnecessarily since day one. No privilege-elevation or confidentiality risk — files are world-readable regardless. Fix reduces edge-runtime CPU + log I/O per asset hit. | fix | Replace dead `public/` in matcher with real URL-root exclusions `assets/\|full-logos/\|maps/\|robots\.txt\|sitemap\.xml`; remove duplicate dead `"/public"` entry from `PUBLIC_PATHS`. Route-collision check clean. | V-1 build · V-2 P-2 grep · V-3 dev-curl (6/6 pass) · V-4 zero middleware runtime lines for excluded paths · V-5 bundle delta 0 · preview P-2 clean | `12396cb` |
