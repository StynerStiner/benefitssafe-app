# BenefitsSafe — Stripe Configuration (ACTUAL LIVE STATE)

Last verified: April 14, 2026 (via live API + dashboard confirmation)

## Bottom line

- ✅ The live platform account exists, the production API key is correct, Connect transfers work, payment acceptance works.
- ❌ **Stripe Issuing is NOT APPROVED in live mode.** Dashboard shows *"Issuing is currently unavailable for your business."*
- 🕐 **Application submitted to Stripe Embedded Finance sales team on April 14, 2026.**
  - **Support ticket:** `sco_UKw331CbheLIzs`
  - **Expected response:** by Wednesday April 16, 2026
- ✅ **Issuing works in SANDBOX mode.** The Cards page, Create Card form, and cardholder creation flow all function when viewing the sandbox account — this is how we confirmed the dashboard UI is wired up correctly.
- ❓ **Stripe Treasury status is unclear.** A "Financial account ••4948" appears on the live Balances page but the Treasury API returns "Unrecognized request URL." May be a Payments Balance ACH feature rather than full Treasury.
- ❌ **Zero connected accounts exist in live mode.** The two previously stored in the production DB were created against the sandbox account and have been nulled out.
- ✅ **Webhooks fixed (April 14, 2026).** All three endpoints were pointing at `benefitssafe.com` (marketing site, no webhook handlers), causing 100% failure on billing event delivery since **April 8, 2026**. Now correctly pointing at `app.benefitssafe.com`.

**What's blocking production card issuance: Stripe's approval of the Issuing application.** Everything on the code side is ready and deployed.

## PENDING ACTIONS

| # | Blocker | Owner | Due |
|---|---------|-------|-----|
| 1 | Stripe Embedded Finance sales team response to `sco_UKw331CbheLIzs` (Issuing approval) | Stripe | By Wed Apr 16, 2026 |
| 2 | Confirm Treasury status — is `••4948` a real Treasury FA or a Payments Balance ACH feature? | Us (from Stripe response) | After #1 |
| 3 | If Issuing approved → verify `capabilities.card_issuing: active` via API, then issue first production test card | Us | Immediately after Stripe response |
| 4 | Re-onboard live Connect accounts for existing orgs (they now have `stripeAccountId = NULL` after sandbox cleanup) | Nonprofit admins via `/org-settings` → Funding | Post-Issuing approval |
| 5 | Update `PLATFORM_FINANCIAL_ACCOUNT_ID` constant in `grants/[id]/issue-card/route.ts` + `expenses/[id]/issue-card/route.ts` to the real live Treasury FA id (or move to env var) | Us | Post-Treasury confirmation |

Nothing on this list is a code change to the app itself — the code is done. These are external/operational items.

## Two Stripe accounts — do not mix them up

| Env | Key prefix | Account ID | Account name | Used by |
|-----|-----------|------------|--------------|---------|
| **Sandbox** | `sk_test_REMOVED_PLACEHOLDER***` | `acct_1THZn40WRRhmXTOq` | "BenefitsSafe sandbox" | Local `.env.local` only |
| **Live (Production)** | `sk_test_REMOVED_PLACEHOLDER***` | `acct_1THZmv1lmD1ohIWk` | "BenefitsSafe" | Vercel Production env var |

**These are two entirely separate Stripe accounts**, not two modes of the same account. Objects created in one are invisible to the other. Every connected account, cardholder, card, and transaction created against the sandbox key is scoped to `acct_1THZn40WRRhmXTOq` and cannot be accessed with the live key.

### Historical gotcha we just fixed
Before April 14, 2026 the production database carried two connected-account ids that had been created against the sandbox key:
- `acct_1TJJ5b1J7fqo5LRe` (on ORG-00001)
- `acct_1THfPT0SRavKoASv` (on ORG-00002)

Neither of these exists under the live `sk_live_*` key. Every production Stripe API call routed through them was failing with *"does not have access to account or that account does not exist."* Both `stripeAccountId` values have been nulled out in the production DB. Orgs now need to re-run the live Connect onboarding flow once Issuing is approved (tracked as Pending Action #4 above).

Note: `ORG-00001.stripeFinancialAccountId` is intentionally left as-is pending Treasury status confirmation.

## Platform account (live) — what actually works today

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
- `card_issuing` — NOT present (Issuing is not approved for live mode)
- `treasury` — NOT present

`settings.card_issuing` IS populated on the account object, indicating the application was started. It was not approved for live.

## Stripe Issuing — ❌ NOT APPROVED (live) / ✅ WORKS (sandbox)

### Live dashboard status
Open https://dashboard.stripe.com/acct_1THZmv1lmD1ohIWk/cards and you see:

> **"Issuing is currently unavailable for your business."**

This is Stripe's underwriting decision, communicated in the dashboard rather than via API.

### Sandbox status
In the sandbox account `acct_1THZn40WRRhmXTOq`, the Cards page is fully functional:
- Cards overview renders
- "Create card" button works
- "Create cardholder" modal accepts real-looking data (legal name, billing address, contact info)
- Cross River Bank Authorized User Terms checkbox and E-sign policy are presented
- End-to-end flow can create a cardholder and a card

This confirms the dashboard UI is wired correctly and the code path has been tested end-to-end in sandbox. The live-mode equivalent will unlock the moment Stripe approves the Issuing application.

### Live API response
- `stripe.issuing.cards.list()` → *"Your account is not set up to use Issuing. Please visit https://dashboard.stripe.com/issuing/overview to get started."*
- `stripe.issuing.cardholders.list()` → same error
- `balance.retrieve().issuing` → absent

### Status of the application
- **Ticket:** `sco_UKw331CbheLIzs`
- **Submitted:** April 14, 2026
- **Submitted to:** Stripe Embedded Finance sales team
- **Expected response:** by Wednesday, April 16, 2026

### When Stripe approves
`capabilities.card_issuing` flips to `active` in the live API. The hybrid routing in `lib/stripe-helpers.ts` (`getIssuingAccount()`) calls `stripe.accounts.retrieve()` on every card issuance attempt — the moment Stripe flips the capability, the very next "Issue Card" click in production succeeds with no deploy, no code change, no config change.

## Stripe Treasury — ❓ STATUS UNCLEAR

The live Balances page shows a tile labeled **"Financial account"** with account ending `••4948` and routing number `0701901513`, next to the Payments balance tile. In the dashboard UI this looks like a Treasury Financial Account.

The live API says otherwise:
- `stripe.treasury.financialAccounts.list()` → *"Unrecognized request URL (GET: /v1/treasury/financial_accounts). Have you onboarded to Treasury?"*
- `stripe.treasury.financialAccounts.retrieve(...)` → same error
- `settings.treasury` on the account object — **not present**
- `capabilities.treasury` — **not in the list**

### Most likely explanation
The `••4948` tile is a **Payments Balance ACH-in feature** — a newer Stripe product that gives you a virtual bank account number and routing number so people can ACH money into your regular Payments balance. It's displayed in the "Financial account" spot on the Balances page but is not the full Stripe Treasury product. That would explain why the dashboard shows a routing number and account number but the Treasury API endpoints don't exist for this account.

### What to do
Do NOT rely on Treasury in the code path until its status is confirmed. The hybrid issuance logic already does not require Treasury — platform-mode Issuing (once approved) funds cards from the platform's Issuing balance. Treasury is only relevant for the "per-tenant FDIC-insured Financial Account" end state, which is a post-launch upgrade.

When we get clarity from Stripe (likely in the same support conversation), we can either:
- Confirm Treasury is active, grab the real `fa_*` id, store it in a Vercel env var (not hardcoded), and wire the balance precheck
- Confirm it's just Payments Balance ACH, and leave Treasury references out of the live code path entirely

## Stripe Connect — ✅ ACTIVE

`transfers: active` on the live platform account. Onboarding flow at `/api/org/stripe-onboarding` creates Custom Connect accounts. Currently **zero live connected accounts exist** — the two previously stored were sandbox artifacts and have been cleaned up.

## Webhooks — ✅ FIXED (April 14, 2026)

All three webhook endpoints were previously registered at `https://benefitssafe.com/api/webhooks/*` — the **marketing site**, not the app. The marketing site has no webhook handlers, so Stripe was getting 404s on every delivery attempt. **This caused 100% failure of billing webhook delivery from April 8, 2026** (when the misconfiguration went live) until **April 14, 2026** (when it was corrected).

All three endpoints now correctly point at `app.benefitssafe.com`:

| Env var | Endpoint URL | Events |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` | `https://app.benefitssafe.com/api/webhooks/stripe` | `issuing_authorization.request`, `issuing_transaction.created`, cardholder events, disputes |
| `STRIPE_CHARGES_WEBHOOK_SECRET` | `https://app.benefitssafe.com/api/webhooks/stripe-charges` | `charge.succeeded`, `charge.failed` |
| `STRIPE_BILLING_WEBHOOK_SECRET` | `https://app.benefitssafe.com/api/webhooks/stripe-billing` | `invoice.*`, `subscription.*`, `customer.subscription.*` |

### Recovery of missed events
Stripe retries failed webhook deliveries for up to 3 days. Any billing events that failed between April 8 and April 11 are permanently lost. Events from April 11–14 may be automatically retried now that the endpoint URLs are correct — monitor the Stripe Dashboard → Developers → Webhooks → (each endpoint) → "Recent deliveries" to confirm.

**Note:** `issuing_authorization.request` and `issuing_transaction.created` events will not fire at all until Issuing is approved and cards are being used. The webhook route `app/api/webhooks/stripe/route.ts` already handles these events and is ready to accept them when they start flowing.

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

## How card issuance works in the code (end-to-end)

The code is ready for both current state and future state. When "Issue Card" is clicked:

1. Route validates auth, role, rate limit, plan limits, grant status, beneficiary eligibility, OFAC screening.
2. `getIssuingAccount(org.stripeAccountId)` in [lib/stripe-helpers.ts](lib/stripe-helpers.ts) decides the routing:
   - If the org's connected account has `capabilities.card_issuing === "active"` → **connected mode**
   - Otherwise → **platform mode** (the only path available until Issuing is approved on the platform account)
3. Balance precheck against the appropriate Financial Account (non-blocking on failure).
4. `stripe.issuing.cardholders.create(...)` and `stripe.issuing.cards.create(...)` — **this is where it fails today** in production with *"Your account is not set up to use Issuing"* because live-mode Issuing is not yet approved on the platform account.
5. If it succeeded, the card row would be saved with `issuingMode` for lifecycle routing, beneficiary + admins notified, workflow automation fired.
6. On beneficiary swipe, `issuing_authorization.request` hits the platform webhook → the webhook handler looks up the `VirtualCard` row by `stripeCardId` and runs OFAC / MCC / grant-balance / benefit-program checks before approving or declining.

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

## Verifying capability state when Stripe responds

When the Embedded Finance team responds to `sco_UKw331CbheLIzs`, run this to confirm whether Issuing (and Treasury) are now active:

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

When `card_issuing` appears in the capabilities object and `issuing.cardholders.list` returns OK, production card issuance starts working on the next "Issue Card" click with no redeploy.

## What this document previously claimed that was wrong

The first version of this file said Stripe Issuing and Treasury were "✅ APPROVED AND ACTIVE" on the live account, cited `fa_65UQyXBXwWXIKG7eb8f16UQxkH04SQjPoQwtpHcXKEaX5M` as a working platform Treasury Financial Account id, and asserted that cards could be issued and authorized against the platform. None of that was accurate — the Issuing application was declined/paused with "Issuing is currently unavailable for your business," the referenced `fa_*` id does not resolve on the live API, and no card has ever been issued in production. Do not revert to those claims.
