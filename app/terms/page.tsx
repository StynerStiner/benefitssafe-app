import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | BenefitsSafe",
  description: "BenefitsSafe Terms of Service - Rules and conditions for using our platform.",
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-neutral-500 mb-8">Effective Date: April 1, 2026 &mdash; Last Updated: April 1, 2026</p>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-neutral-700 dark:text-neutral-300">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the BenefitsSafe platform (&quot;Platform&quot;), operated by BenefitsSafe, Inc.
              (&quot;BenefitsSafe,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), you agree to be bound by these Terms of Service
              (&quot;Terms&quot;). If you do not agree, you may not use the Platform. If you are using BenefitsSafe
              on behalf of an organization, you represent that you have the authority to bind that organization
              to these Terms.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">2. Platform Description</h2>
            <p>
              BenefitsSafe is a grant disbursement platform designed for 501(c)(3) nonprofit organizations.
              The Platform enables nonprofits to manage restricted grant funds, disburse funds to approved
              vendors on behalf of beneficiaries, issue virtual payment cards, track expenses against grant
              budgets, and maintain compliance with federal benefit program rules (SSI, SSDI, Medicaid,
              Medi-Cal, CalFresh, IHSS).
            </p>
            <p>
              BenefitsSafe is <strong>not</strong> a bank, lender, or financial advisor. Payment processing
              and card issuance are provided by Stripe, Inc. under their applicable agreements.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">3. Eligibility</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must be at least 18 years old to use BenefitsSafe.</li>
              <li>Nonprofit organizations must hold valid 501(c)(3) tax-exempt status with a valid EIN.</li>
              <li>Beneficiary accounts must be created by an authorized nonprofit administrator.</li>
              <li>Vendor accounts are subject to our approval and verification process.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">4. Account Registration and Security</h2>
            <p>
              You agree to provide accurate, current, and complete information during registration and to
              keep your account information up to date. You are responsible for maintaining the confidentiality
              of your login credentials, including any MFA devices, and for all activity that occurs under
              your account.
            </p>
            <p>
              You must notify us immediately at security@benefitssafe.com if you suspect unauthorized access
              to your account. We reserve the right to suspend accounts that show signs of compromise.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">5. User Roles and Responsibilities</h2>
            <p>BenefitsSafe supports multiple user roles, each with specific responsibilities:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Nonprofit Administrators:</strong> Responsible for accurate grant data entry, proper fund allocation, timely expense approvals, vendor verification, and ensuring their organization complies with grant terms and benefit program rules.</li>
              <li><strong>Beneficiaries:</strong> Responsible for using disbursed funds only for approved purposes, submitting accurate expense requests, and notifying their nonprofit of changes to their benefit program enrollment.</li>
              <li><strong>Vendors:</strong> Responsible for providing accurate business information, delivering goods/services as invoiced, and complying with our vendor approval standards.</li>
              <li><strong>CPAs / Auditors / Attorneys:</strong> Granted read-only or limited access for compliance review. Responsible for maintaining confidentiality of all data accessed.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">6. Financial Transactions and Virtual Cards</h2>
            <p>
              Virtual payment cards are issued through Stripe Issuing. By requesting or using a virtual card,
              you also agree to Stripe&apos;s applicable terms and conditions.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Virtual cards may only be used for expenses approved under an active grant.</li>
              <li>Transactions at blocked merchant categories (gambling, firearms, alcohol, tobacco, cannabis, adult entertainment) will be automatically declined.</li>
              <li>Grant-level spending controls and merchant restrictions are enforced in real time.</li>
              <li>BenefitsSafe reserves the right to freeze or cancel virtual cards if fraudulent activity, policy violations, or sanctions matches are detected.</li>
              <li>Declined transactions are logged for audit purposes.</li>
            </ul>
            <p>
              <strong>Funding:</strong> Nonprofit organizations are responsible for maintaining sufficient
              funds in their Stripe Treasury Financial Account to cover approved card spending. BenefitsSafe
              uses a Just-In-Time (JIT) funding model; card authorizations are funded from the organization&apos;s
              Financial Account balance at the time of each transaction.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">7. Compliance Responsibilities</h2>
            <p>
              BenefitsSafe provides tools to assist with compliance but does <strong>not</strong> provide
              legal, tax, or financial advice. Our compliance classification engine (LIKELY_SAFE, NEEDS_REVIEW,
              LIKELY_RISKY, BLOCKED) is an automated tool &mdash; not a substitute for professional counsel.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nonprofit administrators remain solely responsible for ensuring all disbursements comply with grant terms and applicable law.</li>
              <li>Compliance classifications are advisory. A &quot;LIKELY_SAFE&quot; rating does not constitute legal advice or guarantee regulatory compliance.</li>
              <li>The AI Compliance Assistant provides general information, not legal counsel.</li>
              <li>Organizations should consult qualified attorneys for compliance decisions involving beneficiary benefits.</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">8. Prohibited Uses</h2>
            <p>You agree <strong>not</strong> to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable law</li>
              <li>Submit false, misleading, or fraudulent grant, expense, or beneficiary information</li>
              <li>Attempt to bypass spending controls, merchant category blocks, or compliance classifications</li>
              <li>Access data belonging to other organizations or users without authorization</li>
              <li>Share login credentials, session tokens, or MFA devices with unauthorized persons</li>
              <li>Use virtual cards for personal expenses unrelated to an approved grant</li>
              <li>Attempt to reverse-engineer, decompile, or interfere with the Platform&apos;s security measures</li>
              <li>Use automated scripts, bots, or scrapers to access the Platform without our written consent</li>
              <li>Conduct or facilitate money laundering, terrorist financing, or sanctions evasion</li>
              <li>Upload malicious files, malware, or content that could harm the Platform or its users</li>
            </ul>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">9. Intellectual Property</h2>
            <p>
              All content, features, and functionality of BenefitsSafe (including software, design, text,
              graphics, and logos) are owned by BenefitsSafe, Inc. and protected by copyright, trademark,
              and other intellectual property laws. You may not reproduce, distribute, or create derivative
              works from any part of the Platform without our written permission.
            </p>
            <p>
              You retain ownership of all data you upload to BenefitsSafe. By uploading content, you grant
              us a limited license to store, process, and display that content solely for the purpose of
              providing the Platform services.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">10. Data Privacy</h2>
            <p>
              Our collection and use of personal information is governed by our{" "}
              <Link href="/privacy" className="text-blue-600 dark:text-blue-400 underline">Privacy Policy</Link>,
              which is incorporated into these Terms by reference. By using BenefitsSafe, you consent to
              our data practices as described in the Privacy Policy.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">11. Service Availability and Modifications</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access. We may
              modify, suspend, or discontinue any feature of the Platform at any time with reasonable notice.
              For material changes that affect your use of the Platform, we will provide at least 30 days&apos;
              notice via email or in-app notification.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">12. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, BENEFITSSAFE SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS
              OF PROFITS, DATA, OR GOVERNMENT BENEFITS, ARISING FROM YOUR USE OF THE PLATFORM.
            </p>
            <p>
              OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE PLATFORM SHALL
              NOT EXCEED THE AMOUNT YOU PAID TO BENEFITSSAFE IN THE 12 MONTHS PRECEDING THE CLAIM, OR $500,
              WHICHEVER IS GREATER.
            </p>
            <p>
              BenefitsSafe is not liable for: (a) actions taken by Stripe, banks, or payment networks;
              (b) loss of government benefits resulting from nonprofit disbursement decisions;
              (c) unauthorized access resulting from your failure to secure your credentials; or
              (d) third-party service outages beyond our control.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">13. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless BenefitsSafe, Inc., its officers, directors,
              employees, and agents from and against any claims, liabilities, damages, losses, and expenses
              (including reasonable attorneys&apos; fees) arising from: (a) your use of the Platform;
              (b) your violation of these Terms; (c) your violation of any third-party rights; or
              (d) fraudulent or inaccurate information you submit through the Platform.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">14. Termination</h2>
            <p>
              You may close your account at any time by contacting support@benefitssafe.com. We may
              suspend or terminate your access if you violate these Terms, engage in fraudulent activity,
              or if required by law.
            </p>
            <p>
              Upon termination: (a) your access to the Platform will cease; (b) active virtual cards will
              be canceled; (c) you may request an export of your data within 30 days; (d) financial records
              and audit logs will be retained as required by law (minimum 7 years).
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">15. Dispute Resolution</h2>
            <p>
              <strong>Governing Law:</strong> These Terms are governed by the laws of the State of California,
              without regard to conflict-of-law principles.
            </p>
            <p>
              <strong>Informal Resolution:</strong> Before filing any formal dispute, you agree to contact
              us at legal@benefitssafe.com and attempt to resolve the dispute informally for at least
              30 days.
            </p>
            <p>
              <strong>Arbitration:</strong> Any dispute not resolved informally shall be settled by binding
              arbitration administered by JAMS under its Streamlined Arbitration Rules in Los Angeles County,
              California. Arbitration will be conducted on an individual basis &mdash; class actions and class
              arbitrations are not permitted.
            </p>
            <p>
              <strong>Exceptions:</strong> Either party may seek injunctive or equitable relief in a court
              of competent jurisdiction for intellectual property infringement, data breaches, or unauthorized
              access.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">16. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. For material changes, we will notify you via
              email and/or a prominent notice on the Platform at least 30 days before the changes take
              effect. Your continued use of BenefitsSafe after the effective date constitutes acceptance
              of the updated Terms. If you do not agree to the updated Terms, you must stop using the
              Platform and close your account.
            </p>
          </section>

          {/* 17 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">17. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable, that provision will be modified
              to the minimum extent necessary, and the remaining provisions will continue in full force
              and effect.
            </p>
          </section>

          {/* 18 */}
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">18. Contact Us</h2>
            <p>If you have questions about these Terms of Service:</p>
            <p className="mt-2">
              <strong>BenefitsSafe, Inc.</strong><br />
              Email: legal@benefitssafe.com<br />
              Website: benefitssafe.com
            </p>
            <p className="mt-4">
              <Link href="/privacy" className="text-blue-600 dark:text-blue-400 underline">Privacy Policy</Link>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
