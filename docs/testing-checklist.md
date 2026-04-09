# BenefitsSafe Manual Testing Checklist

## Browser Testing

- [ ] Chrome (latest) - all 12 role dashboards load
- [ ] Safari (latest) - login + dashboard + navigation
- [ ] Firefox (latest) - login + dashboard + navigation
- [ ] Mobile Safari (iOS) - login + dashboard responsive layout
- [ ] Chrome Mobile (Android) - login + dashboard responsive layout

## Accessibility

- [ ] Run Lighthouse audit on `/auth/login` (target: 90+ accessibility score)
- [ ] Run Lighthouse audit on `/dashboard` (target: 85+ accessibility score)
- [ ] Check color contrast ratios on all status badges (PENDING, APPROVED, REJECTED, BLOCKED)
- [ ] Verify keyboard navigation through all form fields
- [ ] Test tab order on registration form
- [ ] Screen reader compatibility on key pages (VoiceOver/NVDA)

## Payment Flow (End-to-End)

- [ ] Community (free) signup -> register -> verify email -> login -> /dashboard
- [ ] Seed ($49) signup -> Stripe checkout -> register -> verify -> login -> /settings/billing shows Seed plan
- [ ] Core ($99) signup -> Stripe checkout -> register -> verify -> login -> /settings/billing shows Core plan
- [ ] Network ($199) signup -> Stripe checkout -> register -> verify -> login -> /settings/billing shows Network plan
- [ ] Verify NO duplicate checkout triggered after paid signup login
- [ ] Verify promo code extends trial days correctly

## Bank Connection Flow

- [ ] Navigate to Organization Settings > Funding tab
- [ ] Click "Connect Bank Account"
- [ ] Complete Stripe Connect onboarding
- [ ] Verify redirect back with success toast
- [ ] Verify bank details display (name, last4)

## Grant Lifecycle

- [ ] Create DRAFT grant -> verify status shows DRAFT
- [ ] Create ACTIVE grant with budget categories
- [ ] Edit grant (update amount, dates)
- [ ] Add budget categories to grant
- [ ] Archive grant -> verify soft delete

## Expense Flow

- [ ] Submit expense as beneficiary
- [ ] Verify compliance classification runs (check risk badge)
- [ ] Approve expense as admin -> verify grant balance decreases
- [ ] Reject expense as admin -> verify rejection reason displayed
- [ ] Verify BLOCKED expense is auto-rejected on creation

## Card Issuance

- [ ] Issue card from approved expense -> verify card appears
- [ ] Issue card from grant -> verify grantId stored
- [ ] Verify card issuance blocked without bank connection
- [ ] Verify plan limit enforced (maxCardsPerMonth)

## Multi-Org

- [ ] Create second org membership for same user
- [ ] Switch orgs via org picker
- [ ] Verify role changes with org switch
- [ ] Verify data isolation (Org A data not visible in Org B)

## Role Dashboards

- [ ] `nonprofit_admin` -> /dashboard (full access)
- [ ] `nonprofit_staff` -> /dashboard (limited)
- [ ] `beneficiary` -> /my-dashboard (own data only)
- [ ] `vendor` -> /vendor-dashboard
- [ ] `cpa` -> /reports
- [ ] `auditor` -> /audit-trail
- [ ] `attorney` -> /compliance
- [ ] `grant_officer` -> /grants
- [ ] `platform_admin` -> /customers (god mode)
- [ ] `support_agent` -> /support
- [ ] `compliance_officer` -> /compliance
- [ ] `billing_admin` -> /settings/billing

## Security

- [ ] Verify session expires after 1 hour of inactivity
- [ ] Verify CSRF token on all mutation forms
- [ ] Verify API routes return 401 without session
- [ ] Verify API routes return 403 for wrong role
- [ ] Verify org isolation: modify URL params to access other org's data -> 404
