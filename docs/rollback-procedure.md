# BenefitsSafe Rollback Procedure
## Last Updated: April 7, 2026

---

## When to Rollback
- Application returns 500 errors after deployment
- Health check (/api/health) returns "down" status
- Sentry shows spike in new errors immediately after deploy
- UptimeRobot alerts that site is down
- Users report inability to log in or access dashboards
- Database connectivity lost after migration

## Rollback Steps

### Step 1: Vercel Instant Rollback (< 1 minute)
1. Go to https://vercel.com → BenefitsSafe project
2. Click **Deployments** in the top nav
3. Find the **previous working deployment** (the one before the broken deploy)
4. Click the three dots (**...**) on that deployment
5. Click **Promote to Production**
6. Vercel instantly switches production traffic to the previous build
7. Verify: visit https://benefitssafe.com/api/health

### Step 2: If Database Migration Caused the Issue
1. Go to AWS Console → RDS → benefitssafe-db
2. Click **Actions** → **Restore to point in time**
3. Select a time BEFORE the migration ran
4. Restore to a NEW cluster (do not overwrite production)
5. Verify data integrity on the restored cluster
6. Update DATABASE_URL in Vercel to point to restored cluster
7. Redeploy

### Step 3: If Redis Cache Is Corrupted
1. Go to https://console.upstash.com
2. Select benefitssafe-cache
3. Click **CLI** tab
4. Run: `FLUSHDB`
5. Cache rebuilds automatically on next page load

## Post-Rollback Verification
- [ ] https://benefitssafe.com/api/health returns "ok"
- [ ] Admin login works (admin@benefitssafe.com)
- [ ] No new Sentry errors
- [ ] UptimeRobot shows "Up"
- [ ] Dashboard data loads correctly

## Post-Rollback Communication
- [ ] Note the broken commit hash from Vercel
- [ ] Document what went wrong in known-issues.md
- [ ] Fix the issue in a new branch before merging to main

## Contact
- Founder: styner@benefitssafe.com
- Monitoring: monitoring@benefitssafe.com
