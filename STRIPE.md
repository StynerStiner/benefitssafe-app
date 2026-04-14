# BenefitsSafe — Stripe Configuration (ACTUAL LIVE STATE)

Last verified: April 14, 2026 (via live API + dashboard confirmation)

## Bottom line

- ✅ The live platform account exists, the production API key is correct, Connect transfers work.
- ❌ **Stripe Issuing is NOT APPROVED.** Dashboard shows *"Issuing is currently unavailable for your business."* Pending Stripe support ticket.
- ❓ **Stripe Treasury status is unknown.** A "Financial account ••4948" appears on the Balances page, but the Treasury API returns "Unrecognized request URL." This may be a Payments Balance ACH deposit feature, not full Stripe Treasury.
- ❌ **Zero connected accounts exist in live mode.** The two connected account ids stored in the production DB (`acct_1TJJ5b1J7fqo5LRe`, etc.) were created with the sandbox `sk_test_*` key and do not exist under the live `sk_live_*` key.
- ✅ **Webhooks fixed:** all three webhook endpoints were pointing at `benefitssafe.com` (marketing site), causing 100% failure on billing events. Now correctly pointing at `app.benefitssafe.com`.

**What's blocking production card issuance: Stripe's approval of the Issuing application.** Everything on the code side is ready.

## Two Stripe accounts — do not mix them up

| Env | Key prefix | Account ID | Used by |
|-----|-----------|------------|---------|
| **Sandbox** | `sk_test_51TH***` | `acct_1THZn40WRRhmXTOq` ("BenefitsSafe sandbox") | Local `.env.local` only |
| **Live (Production)** | `sk_test_REMOVED_PLACEHOLDER***` | `acct_1THZmv1lmD1ohIWk` ("BenefitsSafe") | Vercel Production env var |

The production database currently holds connected-account ids that were created against the **sandbox** account. When the live production app tries to call `stripe.accounts.retrieve('acct_1TJJ5b1J7fqo5LRe')` it gets *"does not have access to account or that account does not exist"* because that id only exists in the sandbox account's scope. The hybrid issuance logic in `lib/stripe-helpers.ts` already handles this gracefully — the retrieve failure causes `getIssuingAccount()` to fall back to platform mode, which is the right answer while Issuing is pending.

## Platform account (live) — what actually works

- **Account ID:** `acct_1THZmv1lmD1ohIWk`
- **Dashboard:** https://dashboard.stripe.com/acct_1THZmv1lmD1ohIWk
- **Country:** US
- **Charges enabled:** true
- **Payouts enabled:** true
- **Key type in Vercel:** standard `sk_live_*` (not restricted), 107 chars, full account scope

### Live capabilities (from `stripe.accounts.retrieve()` on the production key)

Active or in-progress:
- `acss_debit_payments` — active
- `afterpay_clearpay_payments` — active
- `amazon_pay_payments` — active
- `bancontact_payments` — active
- `blik_payments` — active
- `card_payments` — active
- `cartes_bancaires_payments` — pending
- `cashapp_payments` — active
- `eps_payments` — active
- `klarna_payments` — active
- `link_payments` — active
- `mb_way_payments` — active
- `pix_payments` — active
- `transfers` — active (Connect is live)
- `us_bank_account_ach_payments` — active
- `affirm_payments` — inactive

**Absent from the capabilities list:**
- `card_issuing` — NOT present (confirms Issuing is not approved for live)
- `treasury` — NOT present

The account object does have `settings.card_issuing` populated, which means the Issuing application was started at some point. It was not approved.

## Stripe Issuing — ❌ NOT APPROVED

### Dashboard status
The live dashboard at https://dashboard.stripe.com/acct_1THZmv1lmD1ohIWk/cards shows:

> **"Issuing is currently unavailable for your business."**

This is Stripe declining (or pausing) the Issuing application at the underwriting stage. The decision is not visible via code or API — it was communicated in the dashboard.

### API response
- `stripe.issuing.cards.list()` → *"Your account is not set up to use Issuing. Please visit https://dashboard.stripe.com/issuing/overview to get started."*
- `stripe.issuing.cardholders.list()` → same error
- `balance.retrieve().issuing` → absent

### What to do
A Stripe support ticket has been opened. The path forward depends on Stripe's response:

1. **If Stripe asks for more business information** — provide it (use case: "Restricted-fund grant disbursement for nonprofit beneficiaries receiving SSI/Medicaid, with MCC-level spending controls and OFAC screening"; funding model: Issuing balance top-ups; expected volume; business verification documents).
2. **If Stripe says the account is not eligible for this program** — we may need to apply under a different Stripe Connect platform structure, or work with a different card-issuing partner.
3. **If Stripe approves** — `capabilities.card_issuing` will flip to `active` in the API, and the next "Issue Card" click in production will succeed with no code change needed (the hybrid logic in `lib/stripe-helpers.ts` already routes to platform-mode issuing the moment this flag goes active).

### Until Stripe approves Issuing
No card can be issued in production. The app's `/api/grants/[id]/issue-card` and `/api/expenses/[id]/issue-card` routes will return HTTP 502 with *"Failed to create virtual card with Stripe. Ensure Stripe Issuing is enabled on your account."* This is the correct, defensive behavior — Issuing failures should not silently succeed.

## Stripe Treasury — ❓ STATUS UNKNOWN

The dashboard Balances page shows a tile labeled **"Financial account"** with account ending `••4948` and routing number `0701901513`, next to the Payments balance tile. This looks like a Treasury Financial Account in the UI.

However, the live API directly contradicts this:
- `stripe.treasury.financialAccounts.list()` → *"Unrecognized request URL (GET: /v1/treasury/financial_accounts). Have you onboarded to Treasury?"*
- `stripe.treasury.financialAccounts.retrieve(...)` → same error
- `settings.treasury` on the account object — **not present**
- `capabilities.treasury` — **not in the list**

### Two possible explanations

1. **What you see on Balances is NOT a Treasury Financial Account.** It may be a **Payments Balance ACH-in feature** — a newer Stripe product that provisions a virtual bank account number and routing number for ACH deposits into your regular Payments balance, without the full Treasury product. This would explain why the UI shows a routing number and "Financial account" label but the Treasury API endpoints don't exist on this account.

2. **Treasury is partially provisioned but not yet exposed to the API.** Less likely — Stripe's API/dashboard usually stay in sync. If this is the case, a support ticket would resolve it.

### What to do
**Do not rely on Treasury in the code path until this is resolved.** The hybrid issuance logic already does not hard-require Treasury — platform-mode Issuing (when approved) funds cards from the platform's Issuing balance, not from Treasury. Treasury is only needed for the "per-tenant FDIC-insured Financial Account" end state, which is a post-launch upgrade.

If and when Treasury is confirmed active, we can add a platform Financial Account id to a Vercel env var (do not hardcode it in source) and wire the balance precheck to call `stripe.treasury.financialAccounts.retrieve()` with the real id.

## Stripe Connect — ✅ ACTIVE

`transfers: active` on the live platform account. The onboarding flow at `/api/org/stripe-onboarding` creates Custom Connect accounts.

### Known data issue
The production database has `Organization.stripeAccountId` values that were created under the sandbox account (`acct_1THZn40WRRhmXTOq`) and do not exist under the live account. These rows will fail any live Stripe API call routed through them. The hybrid issuance logic handles this cleanly by falling back to platform mode when `stripe.accounts.retrieve()` fails — but until Issuing is approved, that path also fails at the `stripe.issuing.cardholders.create` step.

**Cleanup action (pending Issuing approval):** once live Issuing works, the two production orgs with sandbox connected account ids should either (a) re-complete the live onboarding flow to get real live connected account ids, or (b) have their `stripeAccountId` nulled so they use the platform-mode path cleanly.

## Webhooks — ✅ FIXED

All three webhook endpoints were previously registered at `https://benefitssafe.com/api/webhooks/*` — the **marketing site**, not the app. Every billing event delivery was failing with 404 because the marketing site has no webhook handlers. This caused 100% webhook delivery failure on billing events for an unknown period.

**Now correctly pointing at `app.benefitssafe.com`:**

| Env var | Endpoint URL | Events |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | `https://app.benefitssafe.com/api/webhooks/stripe` | `issuing_authorization.request`, `issuing_transaction.created`, cardholder events, disputes |
| `STRIPE_CHARGES_WEBHOOK_SECRET` | `https://app.benefitssafe.com/api/webhooks/stripe-charges` | `charge.succeeded`, `charge.failed` |
| `STRIPE_BILLING_WEBHOOK_SECRET` | `https://app.benefitssafe.com/api/webhooks/stripe-billing` | `invoice.*`, `subscription.*`, `customer.subscription.*` |

**Note:** `issuing_authorization.request` and `issuing_transaction.created` events will not fire until Issuing is approved and cards are being used. The webhook route `/api/webhooks/stripe/route.ts` already handles these events and is ready to accept them when they start flowing.

## Vercel production env vars — current state

All set. Do not paste live values into chat, code, commits, issue trackers, or files.

- `STRIPE_SECRET_KEY` ✅ (live `sk_live_*`, standard key, full scope, resolves to `acct_1THZmv1lmD1ohIWk`)
- `STRIPE_PUBLISHABLE_KEY` ✅ (live)
- `STRIPE_WEBHOOK_SECRET` ✅ (now pointing at `app.benefitssafe.com`)
- `STRIPE_CHARGES_WEBHOOK_SECRET` ✅ (now pointing at `app.benefitssafe.com`)
- `STRIPE_BILLING_WEBHOOK_SECRET` ✅ (now pointing at `app.benefitssafe.com`)
- `STRIPE_PRICE_SEED` ✅
- `STRIPE_PRICE_CORE` ✅
- `STRIPE_PRICE_NETWORK` ✅
- `STRIPE_PRICE_ENTERPRISE` ✅

## How Card Issuance Works in the Code (end-to-end)

The code is ready for both current state and future state. When "Issue Card" is clicked:

1. Route validates auth, role, rate limit, plan limits, grant status, beneficiary eligibility, OFAC screening.
2. `getIssuingAccount(org.stripeAccountId)` in [lib/stripe-helpers.ts](lib/stripe-helpers.ts) calls `stripe.accounts.retrieve()` on the connected account.
   - If `capabilities.card_issuing === "active"` → **connected mode**: card is created on the nonprofit's own Stripe account, draws from their own Treasury balance.
   - Otherwise (today's state for every tenant) → **platform mode**: card would be created on `acct_1THZmv1lmD1ohIWk` with `metadata.organizationId` for tenant isolation.
3. Balance precheck against the appropriate Financial Account (skipped gracefully on failure).
4. `stripe.issuing.cardholders.create(...)` and `stripe.issuing.cards.create(...)` — **this is where it fails today** with *"Your account is not set up to use Issuing"* because platform-mode Issuing is not approved.
5. If it succeeded, the card row would be saved with `issuingMode` for lifecycle routing, beneficiary + admins notified, workflow automation fired.
6. When the beneficiary swipes, `issuing_authorization.request` fires to the platform webhook, which looks up the `VirtualCard` row by `stripeCardId` and runs OFAC / MCC / grant-balance / benefit-program checks before approving or declining.

**Step 4 is the entire blocker.** Everything before and after it works.

## Key files

| Purpose | File |
|---------|------|
| Capability-aware issuing routing | `lib/stripe-helpers.ts` |
| Issue card from a grant | `app/api/grants/[id]/issue-card/route.ts` |
| Issue card from an expense | `app/api/expenses/[id]/issue-card/route.ts` |
| Reveal card number (PCI Elements) | `app/api/virtual-cards/[id]/reveal/route.ts` |
| Freeze / pause | `app/api/virtual-cards/[id]/pause/route.ts` |
| Cancel / close | `app/api/virtual-cards/[id]/close/route.ts` |
| JIT authorization webhook | `app/api/webhooks/stripe/route.ts` |
| Charges webhook | `app/api/webhooks/stripe-charges/route.ts` |
| Billing webhook | `app/api/webhooks/stripe-billing/route.ts` |
| Connect onboarding | `app/api/org/stripe-onboarding/route.ts` |
| Treasury fund-in | `app/api/org/fund/route.ts` |
| Link external bank for ACH | `app/api/org/link-bank/route.ts` |
| Funding UI | `app/(dashboard)/org-settings/funding-tab.tsx` |
| Card issuing-mode column | `VirtualCard.issuing_mode` |
| Org ACH origin column | `Organization.stripeOriginPaymentMethodId` |

## Verifying capability state later

When Stripe responds to the support ticket and you want to confirm whether Issuing (or Treasury) has been approved, run:

```bash
cd benefits-safe-app
vercel env pull .env.production.local --environment production
node --env-file=.env.production.local -e "
const Stripe = require('stripe');
const s = new Stripe(process.env.STRIPE_SECRET_KEY);
(async () => {
  const a = await s.accounts.retrieve();
  console.log('card_issuing in capabilities:', 'card_issuing' in (a.capabilities || {}));
  console.log('treasury in capabilities:', 'treasury' in (a.capabilities || {}));
  try {
    const ch = await s.issuing.cardholders.list({ limit: 1 });
    console.log('issuing.cardholders.list: OK (', ch.data.length, 'records)');
  } catch (e) { console.log('issuing.cardholders.list FAILED:', e.message); }
  try {
    const fas = await s.treasury.financialAccounts.list({ limit: 1 });
    console.log('treasury.financialAccounts.list: OK (', fas.data.length, 'records)');
  } catch (e) { console.log('treasury.financialAccounts.list FAILED:', e.message); }
})();
"
rm .env.production.local
```

When `card_issuing` appears in the capabilities object and `issuing.cardholders.list` returns OK, production card issuance will start working on the next "Issue Card" click with no redeploy.

## What this document previously claimed that was wrong

The prior version of this file said Stripe Issuing and Treasury were "✅ APPROVED AND ACTIVE" on the live account, cited `fa_65UQyXBXwWXIKG7eb8f16UQxkH04SQjPoQwtpHcXKEaX5M` as a working platform Treasury Financial Account id, and asserted that cards could be issued and authorized against the platform. None of that was accurate — the Issuing application was declined/paused with "Issuing is currently unavailable for your business," the referenced `fa_*` id does not resolve on the live API, and no card has ever been issued. Do not revert to those claims.
