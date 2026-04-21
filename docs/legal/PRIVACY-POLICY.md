# Privacy Policy

**Version 1.0 | Effective April 21, 2026**

**BenefitsSafe** ("BenefitsSafe," "we," "us," or "our")
1969 Harrington Ave, Oakland, CA 94601

---

## 1. Executive Summary

BenefitsSafe is a software platform that helps US nonprofits disburse restricted grant funds to people who rely on SSI, SSDI, Medi-Cal, CalFresh, and ABLE benefits — without putting those benefits at risk. To do this, we collect information about three groups of people: the nonprofit staff who use the platform, the beneficiaries whose expenses are being paid, and the vendors who get paid. We take privacy seriously because the people we serve are often in vulnerable financial situations, and a data leak could cost them their benefits. This policy explains, in plain language, exactly what we collect, why we collect it, how long we keep it, who we share it with, and how you can control it.

You can always contact us at **privacy@benefitssafe.com** with questions, corrections, or requests.

---

## 2. Definitions

- **BenefitsSafe** — the online platform located at app.benefitssafe.com and associated services operated by BenefitsSafe.
- **Nonprofit** — the 501(c)(3) organization that has a paid subscription and is using BenefitsSafe to manage grant disbursement.
- **Beneficiary** — an individual person who receives goods or services paid for through a Nonprofit's grant on BenefitsSafe.
- **Vendor** — a merchant or service provider that accepts payment from a BenefitsSafe virtual card.
- **Personal Data** — any information that identifies or can reasonably be linked to a specific individual (name, address, Social Security Number, benefit enrollment status, transaction history, etc.).
- **Processing** — any operation performed on Personal Data: collecting, recording, storing, using, sharing, or deleting it.
- **Breach** — unauthorized access to, use of, or disclosure of Personal Data.
- **Subprocessor** — a third-party service we use to help operate the platform (e.g., Stripe, AWS).

---

## 3. Information We Collect

We collect four categories of information.

### 3.1 Nonprofit Organization Data

When your organization signs up and uses BenefitsSafe, we collect:

- Organization legal name, trade name, and mailing address
- Employer Identification Number (EIN)
- 501(c)(3) determination status
- Primary contact information for the account owner and authorized staff
- Bank-account information collected via Stripe Connect for ACH and payout setup; we do not store full account or routing numbers ourselves
- Stripe Connect account ID and associated business-verification data (collected directly by Stripe)
- Grant program details, funder names, and restriction rules you configure

### 3.2 Beneficiary Personal Data

For each Beneficiary your Nonprofit enrolls, we collect:

- Full legal name and preferred name
- Date of birth
- Mailing address
- Last 4 digits of Social Security Number (full SSN only when required for Stripe Issuing cardholder verification, and never displayed back after submission)
- Benefit program enrollment: SSI, SSDI, Medi-Cal, CalFresh, ABLE, IHSS, and similar federal/state programs
- Declared income and asset information relevant to benefit eligibility rules
- Phone number and email (optional, used only for notifications you authorize)

We collect SSN and benefit-enrollment data **only** because Stripe Issuing (our card issuer) requires legally compliant Know-Your-Customer verification, and because our compliance engine needs benefit-program context to flag expenses that could cause a benefits violation. We do not sell, rent, or share this information with advertisers.

### 3.3 Transaction and Financial Data

For every card transaction, expense request, and ledger entry, we record:

- Amount, currency, merchant name, Merchant Category Code (MCC), timestamp, and approval status
- Virtual card identifier (tokenized by Stripe — we never see full card numbers)
- Grant, budget category, and risk classification (LIKELY_SAFE, NEEDS_REVIEW, LIKELY_RISKY, BLOCKED)
- Approver identity and approval notes
- Decline reason (if applicable)
- OFAC screening results (pass/fail and timestamp; we do not store the underlying sanctions-list content)

### 3.4 Technical and Usage Data

When you use the platform, we automatically collect:

- IP address and approximate geographic region
- Device type, browser, operating system, and language
- Pages visited, features used, buttons clicked, session duration
- Error reports and performance traces (via Sentry)
- Authentication events (login, logout, failed password attempts, MFA activity)
- Session fingerprints (a hashed combination of IP + user agent, used to detect session-cookie theft)

We do **not** use third-party behavioral-advertising trackers. We do not sell usage data to ad networks.

---

## 4. How We Use Your Information

Every use of your data falls into one of the categories below. Where GDPR applies, we also identify the lawful basis for each use under Article 6.

| Purpose | What we do | GDPR Lawful Basis |
|---------|------------|-------------------|
| **Run the platform** | Authenticate users, display your dashboards, process grant/expense/card operations. | Contract (Art. 6(1)(b)) — performing our services agreement with your Nonprofit. |
| **Issue and service virtual cards** | Share Beneficiary identity data with Stripe Issuing to verify cardholders and issue cards. | Contract (Art. 6(1)(b)) + Legal obligation (Art. 6(1)(c)) — card issuers are legally required to verify cardholders. |
| **Compliance classification** | Apply federal SSI + state (California Medi-Cal/CalFresh) rules to expense requests to flag benefit risks. | Legitimate interest (Art. 6(1)(f)) — protecting Beneficiary benefits is a core product function. |
| **Fraud and sanctions screening** | Run OFAC and sanctions-list checks; detect unusual transaction patterns; block prohibited Merchant Category Codes. | Legal obligation (Art. 6(1)(c)) — OFAC screening is required by 31 CFR Part 501. |
| **Financial recordkeeping** | Maintain immutable ledger and audit logs for IRS, funder, and auditor review. | Legal obligation (Art. 6(1)(c)) — IRS requires 7-year financial-record retention. |
| **Account security** | Monitor for compromised sessions, failed logins, and suspicious activity. | Legitimate interest (Art. 6(1)(f)) — protecting user accounts. |
| **Communication** | Send transactional emails (receipts, alerts, password resets) and service announcements. | Contract (Art. 6(1)(b)) for transactional; Consent (Art. 6(1)(a)) for optional marketing. |
| **Product analytics** | Aggregated usage analytics to improve the platform (feature adoption, error rates). | Legitimate interest (Art. 6(1)(f)) — product improvement using pseudonymized data. |
| **Legal compliance and disputes** | Respond to subpoenas, audits, and regulatory investigations. | Legal obligation (Art. 6(1)(c)). |

We do **not** use Beneficiary Personal Data to:
- Train machine-learning models without explicit Nonprofit authorization.
- Sell, rent, or license data to data brokers or advertisers.
- Make automated decisions that have a legal or similarly significant effect on a Beneficiary without human review (GDPR Art. 22 / CPRA §1798.185(a)(16)).

---

## 5. Data Retention

We keep data only as long as we need it, and then we delete it. The schedule below is the maximum retention period; we delete sooner if you request it and no legal obligation requires us to keep it.

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| Transaction and ledger records | 7 years after transaction date | IRS financial-records rule (26 CFR §1.6001-1); funder audit requirements. |
| Beneficiary PII (name, DOB, address, SSN4) | 7 years after the Beneficiary leaves the Nonprofit's program | Consistency with linked transaction records. |
| Audit logs (who did what, when) | 2 years | Industry-standard security practice; supports breach investigation. |
| Authentication logs (logins, MFA events) | 1 year | Security monitoring and incident response. |
| Error and performance logs (Sentry) | 90 days | Debugging and reliability engineering. |
| Request access logs (HTTP/CDN) | 90 days | Security and abuse detection. |
| Marketing contact data (form submissions, mailing list) | Until you unsubscribe, then 30 days | Honor unsubscribe, then purge. |
| Support tickets and correspondence | 3 years after resolution | Reference for recurring issues; legal defense. |
| Backups containing the above | Up to 35 days beyond the primary retention period | AWS backup rotation window. |

Once a retention period ends, we delete the primary record within 30 days and the backup copy within the next backup-rotation cycle. Deletion is permanent — we do not retain "shadow" copies.

---

## 6. Who We Share Data With

We share data only with the subprocessors below, only for the purpose described, and only under written data-processing terms that require them to protect your data at least as well as we do.

| Subprocessor | Purpose | Data Types | Location | Their Policy |
|--------------|---------|------------|----------|--------------|
| Stripe, Inc. (incl. Stripe Issuing, Stripe Connect, Stripe Treasury, Stripe Billing) | Payment processing, card issuance, cardholder KYC, subscription billing, Nonprofit ACH onboarding | Beneficiary identity data, card transactions, Nonprofit bank and billing data | United States | [stripe.com/privacy](https://stripe.com/privacy) · [stripe.com/legal](https://stripe.com/legal) |
| Amazon Web Services, Inc. | Application hosting, database (Aurora PostgreSQL), S3 document storage, AWS KMS key management | All platform data (encrypted at rest) | US-West (Oregon) primary; US-East (Virginia) backup | [aws.amazon.com/privacy](https://aws.amazon.com/privacy) |
| Vercel, Inc. | Application hosting and edge delivery for app.benefitssafe.com and benefitssafe.com | HTTP request metadata, deployment logs, encrypted environment variables | United States | [vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy) |
| Cloudflare, Inc. | DNS and CDN/proxy for app.benefitssafe.com; Cloudflare Workers for scheduled cron jobs | HTTP request metadata (IP, user-agent, URL path) | United States (global edge) | [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |
| Postmark (ActiveCampaign) | Transactional email delivery (receipts, alerts, invites) | Email address, user name, message content | United States | [postmarkapp.com/privacy-policy](https://postmarkapp.com/privacy-policy) |
| Sentry (Functional Software, Inc.) | Error and performance monitoring | Pseudonymized error traces, user ID, URL path | United States | [sentry.io/privacy](https://sentry.io/privacy) |
| Upstash, Inc. | Rate limiting, ephemeral caching (Redis), background job queue (QStash) | Pseudonymized request keys, counters, queued job payloads | United States | [upstash.com/trust/privacy.pdf](https://upstash.com/trust/privacy.pdf) |
| Better Stack (Logtail) | Centralized application log storage | Application logs with redacted PII | United States / EU | [betterstack.com/privacy](https://betterstack.com/privacy) |
| Anthropic, PBC | Compliance Assistant AI (Claude) — answers compliance questions; does not receive Beneficiary SSN or full account numbers | Question text, compliance context (no SSN, no card numbers, no bank credentials) | United States | [anthropic.com/legal/privacy](https://anthropic.com/legal/privacy) |
| Composio, Inc. | Workflow automation (org-level integrations for authorized Nonprofit workflows) | Workflow-trigger metadata and payloads the Nonprofit elects to send | United States | [composio.dev/privacy](https://composio.dev/privacy) |
| Google LLC (Google OAuth) | Optional Google sign-in for Nonprofit staff | Email, name, profile image, Google account ID (only when user chooses Google login) | United States | [policies.google.com/privacy](https://policies.google.com/privacy) |
| Microsoft Corporation (Microsoft Entra ID) | Optional Microsoft sign-in for Nonprofit staff | Email, name, Microsoft account ID (only when user chooses Microsoft login) | United States | [privacy.microsoft.com](https://privacy.microsoft.com/privacystatement) |
| Cards issued by **Sutton Bank** and **Evolve Bank & Trust**, Members FDIC | Card-issuance banks for Stripe Issuing | Cardholder identity data (via Stripe) | United States | Governed by Stripe Issuing terms. |

OFAC sanctions screening is performed by calling the US Department of the Treasury's public SDN search API directly; the Treasury is not a commercial subprocessor and no Personal Data leaves our application in a form that could be re-identified (we send first name + last name for the screen).

**Official sanctions reference:** [ofac.treasury.gov](https://ofac.treasury.gov)

We do **not** share your data with:
- Advertising networks
- Data brokers
- Credit bureaus (we do not run credit checks on Beneficiaries)
- Government agencies, except when required by subpoena, court order, or other lawful process; in those cases, where legally permitted, we will notify the affected Nonprofit before producing the records.

We may share aggregated, de-identified data (e.g., "nonprofits on average disburse $X in Y category") that cannot reasonably be linked back to any individual.

---

## 7. Your Privacy Rights

### 7.1 If You Are in the European Economic Area, UK, or Switzerland (GDPR)

Under the General Data Protection Regulation, you have the right to:

- **Access** (Art. 15) — Request a copy of the Personal Data we hold about you.
- **Rectification** (Art. 16) — Correct inaccurate or incomplete data.
- **Erasure / "Right to be forgotten"** (Art. 17) — Request deletion, subject to legal retention obligations (e.g., IRS 7-year rule).
- **Restriction of processing** (Art. 18) — Ask us to pause processing in specific circumstances.
- **Data portability** (Art. 20) — Receive your data in a structured, machine-readable format (we provide JSON and CSV exports).
- **Object to processing** (Art. 21) — Object to processing based on legitimate interest.
- **Not be subject to solely automated decisions** (Art. 22) — Our compliance classifier flags expenses but does not automatically approve or reject them without human review.
- **Withdraw consent** (Art. 7) — Withdraw consent for any processing based on consent, at any time.
- **Lodge a complaint** with your national Data Protection Authority.

To exercise these rights, email **privacy@benefitssafe.com**. We respond within 30 days (extendable by 60 days for complex requests with notice).

If you are a Beneficiary and your rights request affects data your Nonprofit controls, we may route the request to them as the Data Controller.

### 7.2 If You Are a California Resident (CCPA / CPRA)

Under the California Consumer Privacy Act (as amended by the California Privacy Rights Act), you have the right to:

- **Know** what categories of Personal Information we collect, the sources, the purposes, and the categories of third parties we share with.
- **Access** the specific pieces of Personal Information we have about you.
- **Delete** your Personal Information, subject to legal-retention exceptions.
- **Correct** inaccurate Personal Information.
- **Opt out of "sale" or "sharing"** of Personal Information. **We do not sell or share your Personal Information** as those terms are defined under the CCPA. Because we do not sell or share, we do not display a "Do Not Sell or Share My Personal Information" link — there is nothing to opt out of.
- **Limit use of Sensitive Personal Information** — Sensitive Personal Information under CCPA includes SSN and benefit-enrollment status. We use this data only for the purposes identified in Section 4 (e.g., card issuance, compliance), which are permitted uses under CCPA §1798.121(a). You may still submit a request to limit; we will honor it to the extent legally possible.
- **Non-discrimination** — We will not deny service, charge different prices, or provide a different level of service because you exercised a CCPA right.
- **Authorized agent** — You may designate someone else to submit a request on your behalf (we will verify their authorization).

To submit a CCPA request, email **privacy@benefitssafe.com** with the subject line "CCPA Request," or use the privacy request form in your account settings at app.benefitssafe.com. Because BenefitsSafe operates exclusively online and has a direct relationship with account holders, email is an accepted request channel under CCPA §1798.130(a)(1)(A). We verify requests by confirming the email we already have on file, or by matching at least two other data points. We respond within 45 days (extendable by 45 days with notice).

**Categories of Personal Information collected in the past 12 months (CCPA §1798.110 disclosure):**

| Category (CCPA) | Collected? | Sources | Business Purpose | Third-party recipients |
|-----------------|------------|---------|------------------|------------------------|
| Identifiers (name, email, IP, user ID) | Yes | Directly from you; from your Nonprofit | Platform operation, authentication | Stripe, AWS, Postmark, Sentry |
| Personal Information categories under CA Civil Code §1798.80(e) (address, phone) | Yes | Directly from you | Communication, card delivery | Stripe, Postmark |
| Protected classification (age via DOB) | Yes | Directly from you | KYC for card issuance | Stripe |
| Commercial information (transaction history) | Yes | Card network | Grant accounting, compliance | Stripe, AWS |
| Internet/network activity (IP, device, pages) | Yes | Automatically | Security, analytics | AWS, Sentry, Upstash |
| Geolocation (approximate from IP) | Yes | Automatically | Fraud detection | AWS, Sentry |
| Professional/employment info | Limited (nonprofit staff role, title) | Directly from you | Platform role assignment | Internal only |
| **Sensitive PI: SSN (last 4 or full for KYC)** | Yes | Directly from Nonprofit | Card issuance KYC | Stripe only |
| **Sensitive PI: Account log-in credentials** | Yes (hashed passwords, session tokens) | Automatically | Authentication | AWS (storage) |
| **Sensitive PI: Financial account information** | Yes (tokenized) | Directly from Nonprofit via Stripe Connect | ACH and payout setup | Stripe |
| **Sensitive PI: Health/benefit enrollment (Medi-Cal, SSI, etc.)** | Yes | Directly from Nonprofit | Benefits-compliance engine | Internal only |
| Inferences | No | — | — | — |

### 7.3 All Other Users

If you are located outside the EEA/UK/Switzerland and are not a California resident, you still have the rights to access, correct, and delete your data by contacting **privacy@benefitssafe.com**. We respond to all reasonable requests within 30 days.

---

## 8. International Data Transfers

BenefitsSafe is operated in the United States. If you access the platform from the European Economic Area, United Kingdom, Switzerland, or another jurisdiction with a cross-border transfer regime, your data will be transferred to and processed in the United States.

For EU, UK, and Swiss data, we rely on the following transfer mechanisms:

- The **EU-US Data Privacy Framework** (and UK/Swiss extensions), where our US subprocessors are self-certified (Stripe, AWS, and certain others are certified; their certification status is listed at [dataprivacyframework.gov](https://www.dataprivacyframework.gov)).
- **Standard Contractual Clauses** (Commission Implementing Decision (EU) 2021/914) for transfers to subprocessors that are not DPF-certified. Copies are available on request.
- Additional safeguards where required: encryption in transit (TLS 1.2+), encryption at rest (AES-256 via AWS KMS), and contractual audit and security obligations.

We do not transfer data to jurisdictions subject to US sanctions or embargoes.

---

## 9. Cookies and Similar Technologies

BenefitsSafe uses only the minimum cookies and similar technologies required to operate the platform securely. We do **not** use third-party advertising cookies.

| Cookie / Technology | Purpose | Duration | Category |
|---------------------|---------|----------|----------|
| `__Secure-authjs.session-token` | Authentication session | 1 hour rolling, re-issued every 15 minutes of active use | Strictly necessary |
| `__Host-authjs.csrf-token` | CSRF protection | Session | Strictly necessary |
| `__Secure-authjs.callback-url` | Post-login redirect | Session | Strictly necessary |
| `bs-device-fp` | Session-fingerprint for theft detection | 30 days | Security |
| `bs_channel` | Deployment channel routing (stable vs. canary) | 24 hours | Strictly necessary |
| Local Storage keys (UI prefs) | Save your sidebar state, theme, filters | Until you clear browser data | Preference |

All authentication cookies use `HttpOnly`, `Secure`, `SameSite=Lax`, and, in production, the `__Secure-` or `__Host-` cookie name prefix.

Because all cookies we set are strictly necessary or security-related, a cookie consent banner is not required under the ePrivacy Directive's "strictly necessary" exemption. If we later add analytics or marketing cookies, we will introduce a consent banner and update this policy.

---

## 10. Data Security

We apply the following technical and organizational measures:

- **Encryption in transit:** TLS 1.2 or higher for every connection, enforced via HSTS with a two-year max-age and preload-list enrollment.
- **Encryption at rest:** AES-256 via AWS KMS for all databases, backups, and object storage.
- **Access controls:** Role-based access control in the application (12 distinct roles), multi-factor authentication for BenefitsSafe staff, principle of least privilege on AWS IAM.
- **Audit logging:** Immutable AuditLog table records every data mutation with actor, timestamp, and before/after values. Retained for 2 years.
- **Session security:** 1-hour session expiry, session fingerprinting, session-cookie theft detection, rate limiting on authentication endpoints.
- **Input validation:** All inputs validated with Zod schemas before reaching the database; all database queries parameterized via Prisma ORM to prevent SQL injection.
- **Content Security Policy:** Restrictive CSP including `frame-ancestors 'none'`; additional security headers (Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- **Sanctions screening:** OFAC screening on Beneficiary onboarding and periodically thereafter, with fail-closed enforcement at card-authorization time.
- **Payment data:** We never store full card numbers, CVVs, or full bank account numbers. Stripe stores card data under its PCI-DSS Level 1 certification; Plaid tokenizes bank credentials.

We align with the **NIST Cybersecurity Framework** (Identify, Protect, Detect, Respond, Recover) and are actively working toward **SOC 2 Type 2** certification. SOC 2 status will be published at [benefitssafe.com/security](https://benefitssafe.com/security) when complete.

No system is perfectly secure. If you discover a vulnerability, email **security@benefitssafe.com**. We respond to verified reports within 48 hours and do not pursue legal action against good-faith security researchers.

---

## 11. Data Breach Notification

If we determine that a Breach has occurred and it is likely to result in risk to affected individuals, we will:

- **Notify the affected Nonprofit** within **24 hours** of confirmation, consistent with our Data Processing Agreement.
- **Notify affected individuals** as required by applicable law — California Civil Code §1798.82 requires "the most expedient time possible and without unreasonable delay"; GDPR Art. 34 requires notification without undue delay when there is high risk to rights and freedoms.
- **Notify supervisory authorities** within **72 hours** where required (GDPR Art. 33; various US state attorneys general under state breach-notification laws).
- Provide, at minimum: the nature of the Breach, the categories and approximate number of individuals affected, the likely consequences, and the measures we have taken or will take.

Nonprofits are responsible for notifying Beneficiaries whose data is affected; BenefitsSafe will provide a draft notice and cooperate on remediation.

---

## 12. Children's Privacy (COPPA)

BenefitsSafe is not designed for or directed to children under 13, and we do not knowingly collect Personal Information from anyone under 13. Beneficiaries enrolled by a Nonprofit must be at least 13 years old to receive a virtual card (and card issuance via Stripe Issuing has higher age requirements that Stripe enforces). If you believe a child under 13 has submitted Personal Information to us, email **privacy@benefitssafe.com** and we will delete the information promptly.

For Beneficiaries between 13 and 17, the enrolling Nonprofit is responsible for ensuring that a parent or legal guardian has authorized the Beneficiary's enrollment.

---

## 13. Financial Privacy (GLBA and Regulation P)

BenefitsSafe is a software-as-a-service provider, not a bank. Virtual cards on the platform are issued by **Sutton Bank** and **Evolve Bank & Trust**, both members FDIC, via Stripe Issuing. The card-issuing banks are responsible for Gramm-Leach-Bliley Act ("GLBA") privacy notices and Regulation P compliance for cardholder relationships; BenefitsSafe supports their compliance by handling data in accordance with Stripe Issuing's terms.

To the extent GLBA's Safeguards Rule (16 CFR Part 314) applies to our processing of consumer financial information, we maintain a written information-security program consistent with the Rule's requirements, including risk assessments, access controls, encryption, multi-factor authentication, and incident response.

---

## 14. Electronic Funds Transfer Act (EFTA) / Regulation E

If your virtual card is used for electronic funds transfers governed by the Electronic Funds Transfer Act and Regulation E (12 CFR Part 1005), the card-issuing bank (Sutton Bank or Evolve Bank & Trust) is the primary party responsible for error-resolution procedures and consumer-liability limits.

If you believe there is an error on your card or an unauthorized transaction occurred:

1. Notify BenefitsSafe immediately at **support@benefitssafe.com** or through your dashboard's card-dispute flow.
2. We will forward your dispute to the issuing bank within one business day.
3. The issuing bank will investigate under Regulation E and report back within 10 business days (up to 45 business days for complex cases). Provisional credit may be issued after 10 business days.
4. You must notify us within **60 days** of the transaction appearing on your statement to preserve your Regulation E rights; sooner is better.

Your liability for unauthorized transactions is limited per Regulation E §1005.6: $0 if you notify us before any unauthorized use; up to $50 if you notify within two business days of learning of the loss or theft; up to $500 if you notify within 60 days; unlimited after 60 days.

---

## 15. Changes to This Policy

We may update this Privacy Policy to reflect changes in our practices or in applicable law. When we make material changes:

- We will post the updated policy at [benefitssafe.com/privacy](https://benefitssafe.com/privacy) with a new version number and effective date.
- We will email the primary contact of every active Nonprofit at least **30 days** before the changes take effect.
- Your continued use of the platform after the effective date constitutes acceptance of the updated policy.

Previous versions are available on request at **privacy@benefitssafe.com**.

---

## 16. Contact Us

**BenefitsSafe**
Attn: Privacy Officer
1969 Harrington Ave, Oakland, CA 94601
Email: **privacy@benefitssafe.com**

For security vulnerability reports: **security@benefitssafe.com**.

---

## Version History

| Version | Effective Date | Summary |
|---------|----------------|---------|
| 1.0 | April 21, 2026 | Initial publication. |
