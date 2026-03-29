# Production Readiness Fixes — Benefits-Safe App

## STATUS: IN PROGRESS

---

## CRITICAL ISSUES (Fix Before Launch)

### 1. WowDash Template Branding — PRIORITY 1

Replace all "WowDash" references with "BenefitsSafe" in metadata and footer.

#### Files to Fix:

- [ ] **[components-app-main/layout/footer.tsx](components-app-main/layout/footer.tsx)**
  - Line 11: Change `&copy; {currentYear} WowDash. All Rights Reserved.` to `&copy; {currentYear} BenefitsSafe. All Rights Reserved.`

- [ ] **[app/(dashboard)/(homes)/vendor-dashboard/page.tsx](app/(dashboard)/(homes)/vendor-dashboard/page.tsx)**
  - Lines 16-19: Update metadata
  - Change `title: "Investment Dashboard | WowDash Admin Panel"` to `"Vendor Dashboard | BenefitsSafe"`
  - Change description from WowDash template language to BenefitsSafe vendor context

- [ ] **[app/(dashboard)/profile/page.tsx](app/(dashboard)/profile/page.tsx)**
  - Lines 11-15: Update metadata
  - Change `title: "View Profile & User Details | WowDash Admin Dashboard"` to `"My Profile | BenefitsSafe"`
  - Change description to BenefitsSafe branding

- [ ] **[app/(dashboard)/(homes)/my-dashboard/page.tsx](app/(dashboard)/(homes)/my-dashboard/page.tsx)**
  - Lines 15-17: Update metadata
  - Change `title: "AI Dashboard | WowDash Admin Panel"` to `"Dashboard | BenefitsSafe"`
  - Change description appropriately

- [ ] **[app/auth/register/page.tsx](app/auth/register/page.tsx)**
  - Lines 10-12: CRITICAL — Metadata currently says "Cards & Content Containers"
  - Change to: `title: "Register | BenefitsSafe"`
  - `description: "Create a new BenefitsSafe account for your nonprofit organization"`

---

### 2. Localhost URL Fallbacks — PRIORITY 2

Remove localhost fallbacks. These will send invalid invite links in staging/production if NEXTAUTH_URL is missing.

#### Files to Fix:

- [ ] **[app/api/invite/route.ts](app/api/invite/route.ts)**
  - Line 149: Change:
    ```typescript
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
    ```
  - To:
    ```typescript
    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) throw new Error("NEXTAUTH_URL environment variable not set");
    ```

- [ ] **[app/api/users/invite/route.ts](app/api/users/invite/route.ts)**
  - Line 97: Apply same fix as above

---

### 3. Hardcoded Demo Data — PRIORITY 3

Replace all hardcoded demo data with API calls or session data. These show fake users, cards, and statistics.

#### A. Team Users Demo Data
- [ ] **[app/(dashboard)/team/users-grid-card.tsx](app/(dashboard)/team/users-grid-card.tsx)**
  - Lines 70-83: Remove hardcoded `demoUsers` array
  - Use existing fetch logic already in component (it has fallback to empty array)
  - Status: Component already tries to fetch from `/api/users` but displays hardcoded data if fetch fails — fix the fallback to show empty state

#### B. Profile Sidebar Hardcoded User
- [ ] **[app/(dashboard)/profile/components/view-profile-sidebar.tsx](app/(dashboard)/profile/components/view-profile-sidebar.tsx)**
  - Lines 9-41: Replace hardcoded "Robiul Hasan", "ifrandom@gmail.com", phone, department, designation
  - Wire to `useSession()` hook to get logged-in user data
  - Fetch user profile from `/api/users/profile` or session
  - Add loading and error states

#### C. Virtual Card Demo Cards
- [ ] **[app/(dashboard)/(homes)/virtual-cards/components/trending-nft-widgets.tsx](app/(dashboard)/(homes)/virtual-cards/components/trending-nft-widgets.tsx)**
  - Lines 27-48: Remove hardcoded `nftCards` array with fake card numbers "4242", "8888", "1234"
  - Fetch from `/api/virtual-cards`
  - Add loading state

#### D. Virtual Card Featured Creators
- [ ] **[app/(dashboard)/(homes)/virtual-cards/components/featured-creators-card.tsx](app/(dashboard)/(homes)/virtual-cards/components/featured-creators-card.tsx)**
  - Lines 52-95: Remove hardcoded card display "**** 4242", "**** 8888", fake names "James Carter"
  - Wire component props to real card data
  - Component signature shows it accepts `cards` prop but displays hardcoded data

#### E. Virtual Card Top Creators
- [ ] **[app/(dashboard)/(homes)/virtual-cards/components/top-creators-card.tsx](app/(dashboard)/(homes)/virtual-cards/components/top-creators-card.tsx)**
  - Lines 22-29: Remove hardcoded `creatorsData` array
  - Replace with real card assignment data from API

#### F. Vendor Portfolio Statistics
- [ ] **[app/(dashboard)/(homes)/vendor-dashboard/components/my-portfolio-card.tsx](app/(dashboard)/(homes)/vendor-dashboard/components/my-portfolio-card.tsx)**
  - Lines 12-23: Remove hardcoded "$50,000", "$20,000"
  - Calculate from real vendor transaction data via API

#### G. Vendor Static Card Stats
- [ ] **[app/(dashboard)/(homes)/vendor-dashboard/components/static-card.tsx](app/(dashboard)/(homes)/vendor-dashboard/components/static-card.tsx)**
  - Lines 16, 26, 33: Remove hardcoded "%60", "20k", "$5.5k"
  - Fetch from API based on real vendor metrics

#### H. Vendor Dashboard Stats
- [ ] **[app/(dashboard)/(homes)/vendor-dashboard/components/stats-card.tsx](app/(dashboard)/(homes)/vendor-dashboard/components/stats-card.tsx)**
  - Lines 17-22: Remove hardcoded stats array "4000", "15,000"
  - Fetch vendor-specific metrics from API

#### I. Investment Table
- [ ] **[components/table/latest-investments-table.tsx](components/table/latest-investments-table.tsx)**
  - Lines 40-96: Remove fake "Gold", "Silver", "Platinum" investment data
  - Either remove table entirely (unused in vendor context) or wire to real transaction data

#### J. Country/State Beneficiary Counts
- [ ] **[components/shared/country-list.tsx](components/shared/country-list.tsx)**
  - Lines 17-46: Remove hardcoded beneficiary counts (all zeros except "2 Beneficiaries" for California)
  - Fetch from `/api/beneficiaries` and aggregate by state

---

### 4. Debug Console Logs — PRIORITY 4

Remove all debug console.log statements. Move to proper logging if needed.

#### Files to Fix:

- [ ] **[components/shared/profile-dropdown.tsx](components/shared/profile-dropdown.tsx)**
  - Line 17: Remove `console.log("session", session?.user?.image);`

- [ ] **[components/auth/actions/handleResetPassword.ts](components/auth/actions/handleResetPassword.ts)**
  - Line 19: Remove `console.log("Password reset values:", result.data);`

- [ ] **[components/auth/actions/forgot-password.ts](components/auth/actions/forgot-password.ts)**
  - Line 17: Remove `console.log(\`Password reset email sent to ${parsed.data.email}\`);`

- [ ] **[app/api/beneficiaries/route.ts](app/api/beneficiaries/route.ts)**
  - Lines 110, 128, 160: Remove all `console.log()` calls
  - Keep error logging for actual errors only

- [ ] **[app/api/webhooks/stripe/route.ts](app/api/webhooks/stripe/route.ts)**
  - Line 192: Remove `console.log(\`JIT DECLINED: Card ${stripeCardId}...\`);`

- [ ] **[app/api/invite/route.ts](app/api/invite/route.ts) & [app/api/users/invite/route.ts](app/api/users/invite/route.ts)**
  - Lines 183-192 and 102-110: Remove verbose invite logging (or make conditional on DEBUG env var)

---

## HIGH PRIORITY (Fix Soon)

### 5. Broken `href="#"` Links — 115+ instances

Replace all `href="#"` with real routes or remove links entirely.

#### Key Files:

- [ ] **[app/(dashboard)/(homes)/grants/components/project-widgets.tsx](app/(dashboard)/(homes)/grants/components/project-widgets.tsx)**
  - Line 86: Change `<a href="#">View More</a>` to link to grant detail page

- [ ] **[app/(dashboard)/team/page.tsx](app/(dashboard)/team/page.tsx)**
  - Line 55: Fix "Invite Member" button — currently links to "#"
  - Either link to invite workflow or implement inline form

- [ ] **[app/(dashboard)/notification-detail/page.tsx](app/(dashboard)/notification-detail/page.tsx)**
  - Line 79: Fix notification action links

- [ ] **[app/(dashboard)/messages/components/chat-box.tsx](app/(dashboard)/messages/components/chat-box.tsx)**
  - Line 249: Fix message action links

**Search and Replace All:**
```bash
# Find all href="#" in components
grep -r 'href="#"' app/ components/ --include="*.tsx" --include="*.ts"
```

For each:
- If it's a real feature: link to correct route
- If it's unused: remove the link entirely

---

### 6. Missing Error Handling

- [ ] **[app/(dashboard)/team/page.tsx](app/(dashboard)/team/page.tsx)**
  - Lines 29-37: Replace `.catch(() => {})` silent fail with proper error state
  - Show error message to user if fetch fails

---

## MEDIUM PRIORITY (Before Release)

### 7. Template Demo Pages

These pages show template UI component demos and should be hidden or removed:
- [ ] Hide from sidebar navigation: `(components)/card`, `(components)/tooltip`, `(components)/colors`, `(components)/buttons`, etc.
- Or remove from navigation in [components/sidebar-data.ts](components/sidebar-data.ts)

---

## EXECUTION STEPS

### Step 1: WowDash Branding (15 min)
1. Fix footer copyright
2. Update 4 page metadata entries
3. Verify no other WowDash references remain

### Step 2: Localhost Fallbacks (10 min)
1. Update invite/route.ts
2. Update users/invite/route.ts
3. Verify environment variable is required

### Step 3: Console Logs (10 min)
1. Remove all debug console.log calls
2. Search for any remaining console logs
3. Keep only error logging

### Step 4: Hardcoded Demo Data (1-2 hours)
1. Team users → wire to `/api/users`
2. Profile sidebar → use `useSession()` + fetch
3. Virtual cards → fetch from `/api/virtual-cards`
4. Vendor stats → fetch from API
5. Country/state counts → aggregate from API

### Step 5: Broken Links (30 min)
1. Inventory all `href="#"` links
2. Replace with real routes or remove
3. Test all navigation

### Step 6: Error Handling (10 min)
1. Add error states to async operations
2. Show user-facing error messages

---

## VERIFICATION CHECKLIST

Before deploying to production:

- [ ] No "WowDash" text anywhere on public pages
- [ ] All metadata is BenefitsSafe branded
- [ ] No localhost references in API routes
- [ ] No hardcoded demo data visible on any page
- [ ] No `console.log()` statements (except actual errors)
- [ ] No `href="#"` links
- [ ] All async operations have error states
- [ ] Component demo pages are not accessible from sidebar
- [ ] All form inputs work and submit to real API endpoints
- [ ] Session data used instead of hardcoded user info

---

## DEPLOYMENT READINESS

**Status:** ❌ NOT READY

**Blocker Count:** 35+ blockers

**Estimated Fix Time:** 3-4 hours

**Recommended Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7

