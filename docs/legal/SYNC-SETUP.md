# Legal-Docs Sync Setup

**Internal documentation — not published on benefitssafe.com.**

This document explains the one-time setup for the `sync-legal-to-marketing` GitHub Action, which keeps the public legal docs on benefitssafe.com in sync with the source-of-truth copies in this repo.

---

## Mental model

- **Source of truth:** `benefitssafe-app/docs/legal/*.md` (this repo).
- **Published copies:** `benefitssafe-marketing/content/legal/*.md` (rendered at benefitssafe.com/privacy, /terms, /dpa).
- **Never edit the marketing copies directly.** The workflow overwrites them.

When `docs/legal/PRIVACY-POLICY.md`, `TERMS-OF-SERVICE.md`, or `DATA-PROCESSING-AGREEMENT.md` changes on `main`:

1. `.github/workflows/sync-legal-to-marketing.yml` fires.
2. The workflow copies the updated files into `benefitssafe-marketing/content/legal/` on a new branch named `legal-sync/<UTC timestamp>`.
3. A PR is opened against `benefitssafe-marketing` main, labeled `legal` + `auto-sync`, reviewer `stynerdev225`.
4. You review and merge. Vercel auto-deploys the marketing site.

`LEGAL-CHECKLIST.md` and `SYNC-SETUP.md` (this file) are intentionally **not** synced — they are internal operations docs.

---

## One-time setup — GitHub Personal Access Token

The workflow needs a PAT with `repo` scope so it can push a branch and open a PR in `benefitssafe-marketing` (which lives under the same account but is a separate repo).

### Before you start — security

- **Never paste the PAT into a commit, a chat log, an AI assistant prompt, a shared doc, or a screenshot.** A leaked PAT with `repo` scope is equivalent to handing over push rights to every repo under stynerdev225.
- **If a PAT is ever exposed (even once), revoke it immediately** and generate a new one. Token values are unrecoverable once shown; only the revoke/rotate path is safe.
- GitHub Secrets store the PAT encrypted at rest and inject it into the workflow runtime. That is the only acceptable place for it.

### Steps

1. Open https://github.com/settings/tokens/new?type=classic
2. **Note:** `BenefitsSafe legal sync — app→marketing`
3. **Expiration:** 1 year (calendar-remind yourself to rotate it)
4. **Scopes:**
   - Check `repo` (Full control of private repositories) — the PAT needs `repo:status`, `public_repo`, and `repo_deployment` implicitly via `repo`
   - No other scopes are required
5. Click **Generate token** and **copy the token now** — GitHub will not show it again.
6. Go to https://github.com/stynerdev225/benefitssafe-app/settings/secrets/actions
7. Click **New repository secret**
8. **Name:** `MARKETING_REPO_PAT` (exact — the workflow references this name)
9. **Secret:** paste the token
10. Click **Add secret**

### Verify the secret is live

From this repo, run:

```bash
gh secret list --repo stynerdev225/benefitssafe-app | grep MARKETING_REPO_PAT
```

You should see the name and "Updated <date>"; the value itself is never shown.

---

## First-run verification

1. Make a trivial edit to any of the three synced docs (e.g., bump `Version` in the version-history table of `PRIVACY-POLICY.md`).
2. Commit and push to `main`.
3. Watch the workflow run: https://github.com/stynerdev225/benefitssafe-app/actions/workflows/sync-legal-to-marketing.yml
4. Once green, confirm a PR appeared at https://github.com/stynerdev225/benefitssafe-marketing/pulls
5. Review the PR diff. Merge if correct.
6. After merge, verify on the live site: `curl -s https://benefitssafe.com/privacy | grep -o "Version [0-9.]*" | head -1`

---

## Rotation

Rotate the PAT annually or immediately if any of the following happen:

- The token is pasted into a non-secret location (even briefly).
- A machine that used the token is lost or compromised.
- A contractor with visibility into GitHub Actions logs departs.
- GitHub warns of token leakage (Dependabot / Secret Scanning alerts).

To rotate:

1. Create a new token with the same scopes.
2. Update `MARKETING_REPO_PAT` in repo secrets (same name — the workflow picks up the new value immediately).
3. Revoke the old token at https://github.com/settings/tokens.

---

## What the workflow does NOT do

- It does not auto-merge. Every legal change requires a human reviewer.
- It does not force-push to marketing `main`.
- It does not sync `LEGAL-CHECKLIST.md` or this file (`SYNC-SETUP.md`).
- It does not touch anything outside `content/legal/` in the marketing repo.
- It does not run on pull requests — only on merges to `main`.

---

## Drift check (run anytime)

The workflow is the forward path (app → marketing). If you want to confirm parity at any moment:

```bash
./scripts/verify-legal-sync.sh
```

The script clones the marketing repo into a temp dir and compares SHA-256 hashes of the three synced files. Exits 0 in sync, 1 if drift. Safe to run locally or in CI.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Workflow run fails at "Checkout marketing repo" with `fatal: could not read Username` | `MARKETING_REPO_PAT` is missing, expired, or lacks `repo` scope | Regenerate the PAT with `repo` scope and update the secret |
| Workflow succeeds but no PR appears | No content actually changed in `content/legal/` (e.g., you edited `LEGAL-CHECKLIST.md` only) | Expected. Only the three synced files trigger a PR |
| PR creation fails with `Resource not accessible by integration` | PAT does not have permission to the marketing repo | Ensure the PAT is scoped `repo` and the token owner has write access to `benefitssafe-marketing` |
| `gh label create` fails | Labels already exist | Expected and ignored by `\|\| true` in the workflow |
| Drift script reports "DRIFT" right after a merge | Vercel hasn't redeployed marketing yet; or the workflow run hasn't completed | Wait 60 seconds and re-run; if still drifting, check the Actions tab |

---

## Owner / contact

Automation owned by Styner Stiner. For security concerns, email security@benefitssafe.com. For workflow questions or breakage, file an issue in `benefitssafe-app`.
