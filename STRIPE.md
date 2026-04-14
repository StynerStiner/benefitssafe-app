# BenefitsSafe — Stripe Configuration (CONFIRMED LIVE)

Last verified: April 14, 2026

## Platform Account

- **Account ID:** acct_1THZmv1lmD1ohIWk
- **Dashboard:** https://dashboard.stripe.com/acct_1THZmv1lmD1ohIWk
- **Country:** US
- **Status:** Live (charges_enabled, payouts_enabled)

## Stripe Issuing — ✅ APPROVED AND ACTIVE

- Cards are issued by **Celtic Bank**
- Card creation, spending controls, MCC blocking all functional
- Dashboard: https://dashboard.stripe.com/acct_1THZmv1lmD1ohIWk/cards

## Stripe Treasury — ✅ APPROVED AND ACTIVE

- Financial Account ID: `fa_65UQyXBXwWXIKG7eb8f16UQxkH04SQjPoQwtpHcXKEaX5M`
- Account holder: Kishana Stiner
- Routing number: 071919133
- Bank partner: Fifth Third Bank N.A., Member FDIC
- FDIC pass-through insurance up to $250,000 per depositor
- Dashboard: https://dashboard.stripe.com/acct_1THZmv1lmD1ohIWk/balance/financial-accounts/fa_65UQyXBXwWXIKG7eb8f16UQxkH04SQjPoQwtpHcXKEaX5M?currency=usd

## Stripe Connect — ✅ ACTIVE

- Nonprofits onboard as connected accounts
- Each nonprofit gets their own Stripe Connect account during onboarding
- Onboarding route: app/api/org/stripe-onboarding/route.ts

## Webhook Endpoints (3 secrets, all in Vercel)

| Env Var | Webhook Route | Events |
|---------|--------------|--------|
| STRIPE_WEBHOOK_SECRET | /api/webhooks/stripe | issuing_authorization.request, issuing_transaction.created, cardholder events, disputes |
| STRIPE_CHARGES_WEBHOOK_SECRET | /api/webhooks/stripe-charges | charge.succeeded, charge.failed |
| STRIPE_BILLING_WEBHOOK_SECRET | /api/webhooks/stripe-billing | invoice.*, subscription.*, customer.subscription.* |

## Vercel Env Vars (all set for Production, Preview, Development)

- STRIPE_SECRET_KEY ✅
- STRIPE_PUBLISHABLE_KEY ✅
- STRIPE_WEBHOOK_SECRET ✅
- STRIPE_CHARGES_WEBHOOK_SECRET ✅
- STRIPE_BILLING_WEBHOOK_SECRET ✅
- STRIPE_PRICE_SEED ✅
- STRIPE_PRICE_CORE ✅
- STRIPE_PRICE_NETWORK ✅
- STRIPE_PRICE_ENTERPRISE ✅

## How Card Issuance Works (end-to-end)

1. Nonprofit completes Stripe Connect onboarding → gets a connected account
2. Nonprofit's connected account gets a Treasury Financial Account (auto-created during onboarding)
3. Nonprofit funds their Financial Account via ACH from their bank ("Add funds")
4. Admin clicks "Issue Card" on a grant → creates a Stripe cardholder + virtual card with MCC spending controls
5. Beneficiary sees the card in their dashboard → can reveal card number via Stripe ephemeral keys
6. Beneficiary swipes card at merchant → issuing_authorization.request webhook fires
7. Webhook checks: OFAC, card status, spending cap, grant funded, MCC rules, benefit program limits
8. Webhook returns approved/declined → Stripe authorizes or declines the transaction
9. Transaction logged in DB, ledger updated, admin notified if flagged

## STOP GUESSING — READ THIS FILE

If you are unsure whether Stripe Issuing or Treasury is active, READ THIS FILE.
Do NOT re-audit the Stripe API capabilities — the API can return stale/incorrect capability status on platform accounts with Treasury. The dashboard is the source of truth and it confirms both are active.
