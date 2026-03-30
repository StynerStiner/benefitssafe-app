import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | BenefitsSafe",
  description: "BenefitsSafe Privacy Policy - How we collect, use, and protect your data.",
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-neutral-500 mb-8">Last updated: March 30, 2026</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-neutral-700 dark:text-neutral-300">
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">1. Introduction</h2>
            <p>
              BenefitsSafe (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a grant disbursement platform that helps nonprofit
              organizations manage restricted funds on behalf of beneficiaries receiving SSI, SSDI, Medicaid,
              and Medi-Cal benefits. This Privacy Policy explains how we collect, use, disclose, and safeguard
              your information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">2. Information We Collect</h2>
            <p><strong>Account Information:</strong> Name, email address, organization name, EIN (Employer Identification Number), and role within your organization.</p>
            <p><strong>Authentication Data:</strong> We use Google OAuth and email/password authentication. We do not store your Google password.</p>
            <p><strong>Financial Data:</strong> Grant amounts, expense records, vendor payment information, and virtual card transaction data. All financial data is encrypted at rest and in transit.</p>
            <p><strong>Beneficiary Data:</strong> First name, last name, date of birth, benefit program enrollment status (SSI, SSDI, Medi-Cal). We store only the last 4 digits of Social Security Numbers.</p>
            <p><strong>Usage Data:</strong> Log data, device information, and analytics to improve our platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and maintain the BenefitsSafe platform</li>
              <li>Process grant disbursements and expense approvals</li>
              <li>Verify nonprofit status through EIN verification</li>
              <li>Ensure compliance with SSI, SSDI, and Medicaid regulations</li>
              <li>Issue and manage virtual payment cards via Stripe</li>
              <li>Generate financial reports and audit trails</li>
              <li>Send notifications about account activity</li>
              <li>Prevent fraud and unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">4. Data Protection</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>TLS/SSL encryption for all data in transit</li>
              <li>AES-256 encryption for data at rest</li>
              <li>Multi-factor authentication (MFA/2FA)</li>
              <li>Role-based access control (RBAC) with 12 distinct user roles</li>
              <li>Immutable audit logs for all financial transactions</li>
              <li>Regular security assessments and monitoring via Sentry</li>
              <li>AWS infrastructure with SOC 2 compliance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">5. Data Sharing</h2>
            <p>We do not sell your personal information. We share data only with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Stripe:</strong> For payment processing and virtual card issuance</li>
              <li><strong>Amazon Web Services (AWS):</strong> For secure data storage and hosting</li>
              <li><strong>Your Organization:</strong> Admins within your nonprofit can view data related to their organization</li>
              <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">6. Your Rights</h2>
            <p>Under CCPA/CPRA and applicable privacy laws, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal information</li>
              <li>Request deletion of your data</li>
              <li>Opt out of data sharing</li>
              <li>Request a copy of your data in a portable format</li>
              <li>Correct inaccurate personal information</li>
            </ul>
            <p>To exercise these rights, contact us at privacy@benefitssafe.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">7. Data Retention</h2>
            <p>
              We retain financial records and audit logs for a minimum of 7 years as required by IRS regulations
              for nonprofit organizations. Account data is retained for the duration of your account plus 30 days
              after deletion request. Beneficiary data follows HIPAA-aligned retention policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We do not use third-party
              tracking cookies or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">9. Children&apos;s Privacy</h2>
            <p>
              BenefitsSafe is not intended for use by individuals under 18. We do not knowingly collect
              information from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of material changes
              via email or platform notification.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, contact us at:
            </p>
            <p>
              <strong>BenefitsSafe</strong><br />
              Email: privacy@benefitssafe.com<br />
              Website: https://benefitssafe.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
