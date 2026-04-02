import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | BenefitsSafe",
  description: "BenefitsSafe Privacy Policy - How we collect, use, and protect your data under CCPA/CPRA.",
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-neutral-500 mb-8">Effective Date: April 1, 2026 &mdash; Last Updated: April 1, 2026</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-neutral-700 dark:text-neutral-300">

          {/* 1 — INTRODUCTION */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">1. Introduction</h2>
            <p>
              BenefitsSafe, Inc. (&quot;BenefitsSafe,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates a grant
              disbursement platform that helps nonprofit organizations manage restricted funds on behalf of
              beneficiaries receiving Supplemental Security Income (SSI), Social Security Disability Insurance
              (SSDI), Medicaid, Medi-Cal, CalFresh, and In-Home Supportive Services (IHSS) benefits.
            </p>
            <p>
              This Privacy Policy describes the categories of personal information we collect, how we use and
              share that information, the rights available to you under the California Consumer Privacy Act
              as amended by the California Privacy Rights Act (&quot;CCPA/CPRA&quot;), and how to exercise those rights.
            </p>
            <p>
              By creating an account or using our platform you agree to this Privacy Policy. If you do not
              agree, please do not use BenefitsSafe.
            </p>
          </section>

          {/* 2 — INFORMATION WE COLLECT */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">2. Categories of Personal Information We Collect</h2>
            <p>We collect the following categories of personal information as defined under CCPA &sect;1798.140(v):</p>

            <table className="w-full text-sm border-collapse mt-4">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-2 pr-4 font-semibold">Category</th>
                  <th className="text-left py-2 font-semibold">Examples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                <tr><td className="py-2 pr-4 align-top font-medium">A. Identifiers</td><td className="py-2">Full name, email address, organization name, EIN, user ID</td></tr>
                <tr><td className="py-2 pr-4 align-top font-medium">B. Personal Information (Cal. Civ. Code &sect;1798.80)</td><td className="py-2">Name, phone number, address, date of birth, last 4 digits of SSN (beneficiaries only)</td></tr>
                <tr><td className="py-2 pr-4 align-top font-medium">D. Commercial Information</td><td className="py-2">Grant amounts, expense records, virtual card transactions, vendor payment history, subscription details</td></tr>
                <tr><td className="py-2 pr-4 align-top font-medium">F. Internet / Network Activity</td><td className="py-2">Login timestamps, IP address, browser user-agent, device fingerprint hash, pages visited</td></tr>
                <tr><td className="py-2 pr-4 align-top font-medium">G. Geolocation Data</td><td className="py-2">Approximate location derived from IP address (city/state level only)</td></tr>
                <tr><td className="py-2 pr-4 align-top font-medium">K. Inferences</td><td className="py-2">Compliance risk classification of expense requests (LIKELY_SAFE, NEEDS_REVIEW, LIKELY_RISKY, BLOCKED)</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-6">Sensitive Personal Information</h3>
            <p>
              Under CPRA, we may collect the following sensitive personal information:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Last 4 digits of Social Security Number (beneficiaries only, for identity verification)</li>
              <li>Government benefit program enrollment status (SSI, SSDI, Medi-Cal, CalFresh, IHSS)</li>
              <li>Financial account information processed through Stripe (we do not store full card numbers)</li>
            </ul>
            <p>
              We use sensitive personal information <strong>only</strong> for the purposes of providing our
              services (grant disbursement, compliance verification, virtual card issuance) and not for profiling
              or advertising. You have the right to limit our use of sensitive personal information &mdash; see
              Section 7 below.
            </p>
          </section>

          {/* 3 — SOURCES */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">3. Sources of Personal Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Directly from you:</strong> When you register, create grants, submit expenses, upload documents, or contact support</li>
              <li><strong>From your organization&apos;s administrator:</strong> When an admin adds you as a team member, beneficiary, or vendor</li>
              <li><strong>Automatically:</strong> Login activity, device fingerprints, IP addresses, and session data collected for security</li>
              <li><strong>Third-party service providers:</strong> Stripe (payment/card data), Google/Microsoft (OAuth authentication), AWS (infrastructure)</li>
              <li><strong>Government databases:</strong> OFAC SDN list screening for sanctions compliance (name-matching only)</li>
            </ul>
          </section>

          {/* 4 — HOW WE USE */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">4. How We Use Your Information</h2>
            <p>We use personal information for the following business and commercial purposes:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Providing, maintaining, and improving the BenefitsSafe platform</li>
              <li>Processing grant disbursements, expense approvals, and virtual card transactions</li>
              <li>Verifying nonprofit status through EIN verification</li>
              <li>Classifying expense requests for SSI/SSDI/Medicaid compliance</li>
              <li>Screening against OFAC sanctions lists as required by federal law</li>
              <li>Issuing and managing virtual payment cards via Stripe Issuing</li>
              <li>Generating financial reports, audit trails, and ledger entries</li>
              <li>Sending transactional notifications about account and grant activity</li>
              <li>Detecting fraud, unauthorized access, and session anomalies</li>
              <li>Responding to your support requests</li>
              <li>Complying with legal obligations (IRS record-keeping, anti-money laundering)</li>
            </ul>
            <p>
              We do <strong>not</strong> use personal information for behavioral advertising, profiling for
              unrelated purposes, or cross-context behavioral advertising.
            </p>
          </section>

          {/* 5 — DATA SHARING */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">5. How We Share Your Information</h2>
            <p><strong>We do not sell your personal information.</strong> We have not sold personal information in the preceding 12 months.</p>
            <p><strong>We do not share your personal information for cross-context behavioral advertising.</strong></p>
            <p>We disclose personal information to the following categories of third parties for business purposes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Stripe, Inc.:</strong> Payment processing, virtual card issuance, Treasury financial accounts, KYC verification, and transaction monitoring. Stripe acts as our payment processor under its own privacy policy.</li>
              <li><strong>Amazon Web Services (AWS):</strong> Cloud infrastructure, database hosting (RDS PostgreSQL), file storage (S3), and encryption services. AWS processes data under our instructions as a service provider.</li>
              <li><strong>Google / Microsoft:</strong> OAuth authentication only (if you choose to sign in with Google or Microsoft). We receive only your name and email.</li>
              <li><strong>Anthropic:</strong> AI compliance assistant queries are processed by Claude. No personally identifiable financial data is sent to the AI model.</li>
              <li><strong>Your organization:</strong> Admins within your nonprofit can view data related to their organization&apos;s grants, expenses, and beneficiaries.</li>
              <li><strong>Legal requirements:</strong> When required by law, subpoena, court order, or government investigation.</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets (with prior notice to you).</li>
            </ul>
          </section>

          {/* 6 — DATA PROTECTION */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">6. Data Protection Measures</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>TLS 1.2+ encryption for all data in transit</li>
              <li>AES-256-GCM encryption for sensitive data at rest</li>
              <li>TOTP-based multi-factor authentication (MFA) with encrypted backup codes</li>
              <li>Role-based access control (RBAC) with 12 distinct user roles</li>
              <li>Immutable, append-only audit logs for all financial transactions</li>
              <li>Session fingerprinting and trusted device tracking to detect stolen sessions</li>
              <li>OFAC sanctions screening before virtual card issuance</li>
              <li>Merchant category code (MCC) blocking at three layers (Stripe, webhook, grant-level)</li>
              <li>Rate limiting on authentication and financial endpoints</li>
              <li>AWS infrastructure with SOC 2 Type II compliance</li>
              <li>Stripe PCI DSS Level 1 certification for all card data handling</li>
              <li>Regular security assessments following OWASP Top 10 and NIST guidelines</li>
            </ul>
          </section>

          {/* 7 — YOUR CCPA/CPRA RIGHTS */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">7. Your Privacy Rights (CCPA/CPRA)</h2>
            <p>If you are a California resident, you have the following rights:</p>

            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-4">Right to Know / Access</h3>
            <p>
              You may request that we disclose the categories and specific pieces of personal information we
              have collected about you, the sources of that information, the business purposes for collection,
              and the categories of third parties with whom we share it.
            </p>

            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-4">Right to Delete</h3>
            <p>
              You may request deletion of your personal information. We will comply except where retention is
              required by law (e.g., IRS 7-year record retention for nonprofit financial records, active
              legal proceedings, or fraud prevention). When we cannot fully delete, we will anonymize your
              data by replacing personally identifiable fields with anonymized values and deactivating your account.
            </p>

            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-4">Right to Correct</h3>
            <p>
              You may request correction of inaccurate personal information. You can also update most
              account information directly through your profile settings.
            </p>

            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-4">Right to Opt-Out of Sale / Sharing</h3>
            <p>
              We do not sell or share personal information for cross-context behavioral advertising.
              No opt-out is necessary, but we honor Global Privacy Control (GPC) signals.
            </p>

            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-4">Right to Limit Use of Sensitive Personal Information</h3>
            <p>
              You may request that we limit use of sensitive personal information (SSN last 4, benefit
              program status) to only what is necessary to provide our services. Contact us to exercise
              this right.
            </p>

            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-4">Right to Non-Discrimination</h3>
            <p>
              We will not discriminate against you for exercising any privacy right. You will not receive
              different pricing, quality of service, or access levels for exercising your rights.
            </p>

            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mt-4">Right to Data Portability</h3>
            <p>
              You may request a copy of your personal information in a structured, commonly used,
              machine-readable format (JSON). Use the &quot;Export My Data&quot; feature in your account
              settings or contact us directly.
            </p>
          </section>

          {/* 8 — HOW TO EXERCISE */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">8. How to Exercise Your Rights</h2>
            <p>You may submit a verifiable consumer request by:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Emailing <strong>privacy@benefitssafe.com</strong> with the subject &quot;Privacy Rights Request&quot;</li>
              <li>Using the in-app data export or deletion features under Account Settings</li>
            </ul>
            <p className="mt-2">
              <strong>Verification:</strong> We will verify your identity using your account email address
              and, for sensitive requests, may require additional verification (e.g., confirming recent
              account activity). We aim to respond within <strong>45 calendar days</strong>. If we need
              additional time, we will notify you of the extension (up to 90 days total) and the reason.
            </p>
            <p>
              <strong>Authorized Agents:</strong> You may designate an authorized agent to submit requests
              on your behalf. The agent must provide written authorization signed by you, and we may
              contact you directly to verify the request.
            </p>
          </section>

          {/* 9 — DATA RETENTION */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">9. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Financial records and audit logs:</strong> 7 years minimum (IRS &sect;6001 record-keeping requirement for tax-exempt organizations)</li>
              <li><strong>Ledger entries:</strong> Permanently retained (immutable by design for audit integrity)</li>
              <li><strong>Account data:</strong> Duration of active account plus 30 days after deletion request</li>
              <li><strong>Session and security logs:</strong> 90 days (IP addresses, device fingerprints, login history)</li>
              <li><strong>Uploaded documents:</strong> Retained until the associated grant is closed plus 7 years, or until deletion is requested</li>
              <li><strong>Stripe card/transaction data:</strong> Managed by Stripe under their retention policy; we retain transaction references for 7 years</li>
            </ul>
          </section>

          {/* 10 — COOKIES */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">10. Cookies and Tracking Technologies</h2>
            <p>We use only <strong>essential cookies</strong> required for platform functionality:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Session cookie</strong> (authjs.session-token): Maintains your authenticated session. HttpOnly, Secure, SameSite=Lax.</li>
              <li><strong>Device fingerprint cookie</strong> (bs-device-fp): Detects session hijacking. HttpOnly, Secure, 30-day expiry.</li>
              <li><strong>CSRF token</strong>: Prevents cross-site request forgery on form submissions.</li>
            </ul>
            <p>
              We do <strong>not</strong> use third-party tracking cookies, advertising cookies, analytics
              cookies, or social media tracking pixels. We honor Do Not Track (DNT) and Global Privacy
              Control (GPC) signals.
            </p>
          </section>

          {/* 11 — CHILDREN */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">11. Children&apos;s Privacy</h2>
            <p>
              BenefitsSafe is not intended for use by individuals under the age of 18. We do not knowingly
              collect personal information from minors. If we learn that we have collected information from
              a child under 18, we will promptly delete it. If you believe a minor has provided us with
              personal information, please contact us at privacy@benefitssafe.com.
            </p>
          </section>

          {/* 12 — DO NOT SELL */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">12. &quot;Do Not Sell or Share My Personal Information&quot;</h2>
            <p>
              BenefitsSafe does not sell personal information and has never sold personal information. We
              do not share personal information for cross-context behavioral advertising as defined under
              CPRA. Because we do not engage in these practices, no opt-out mechanism is required; however,
              we respect and process Global Privacy Control (GPC) signals as a valid opt-out request.
            </p>
          </section>

          {/* 13 — SHINE THE LIGHT */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">13. California &quot;Shine the Light&quot; (Cal. Civ. Code &sect;1798.83)</h2>
            <p>
              California residents may request information about our disclosure of personal information to
              third parties for their direct marketing purposes. As stated above, we do not disclose personal
              information to third parties for their direct marketing purposes.
            </p>
          </section>

          {/* 14 — CHANGES */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">14. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. For material changes, we will notify you
              via email to the address associated with your account and/or by posting a prominent notice on
              our platform at least 30 days before the changes take effect. Your continued use of BenefitsSafe
              after the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* 15 — CONTACT */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">15. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or wish to exercise your privacy rights:</p>
            <p className="mt-2">
              <strong>BenefitsSafe, Inc.</strong><br />
              Email: privacy@benefitssafe.com<br />
              Website: benefitssafe.com<br />
            </p>
            <p className="mt-4">
              <Link href="/terms" className="text-blue-600 dark:text-blue-400 underline">Terms of Service</Link>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
