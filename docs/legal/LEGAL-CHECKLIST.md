# BenefitsSafe Legal Launch Checklist

**Version 1.0 | Effective April 21, 2026**

This checklist tracks everything that must happen before, during, and after publishing the three legal documents:

- [PRIVACY-POLICY.md](./PRIVACY-POLICY.md) — end-user privacy notice
- [TERMS-OF-SERVICE.md](./TERMS-OF-SERVICE.md) — subscription contract with Nonprofits
- [DATA-PROCESSING-AGREEMENT.md](./DATA-PROCESSING-AGREEMENT.md) — GDPR/CCPA processor terms for Nonprofit procurement

---

## IMPORTANT: Before You Publish

These documents are comprehensive drafts tailored to BenefitsSafe's fintech + SSI/Medi-Cal use case. They reflect current best practice for GDPR, CCPA/CPRA, GLBA, EFTA/Regulation E, and California-specific requirements. They are **not** a substitute for a final review by a California-licensed attorney with fintech and data-privacy experience, especially because:

- BenefitsSafe touches regulated financial products (Stripe Issuing, partner banks).
- Beneficiary SSN and benefit-enrollment data is extraordinarily sensitive.
- State privacy laws are evolving quickly (new state laws in 2026; CPRA regulations still being finalized).
- Card-issuance terms with Sutton Bank / Evolve Bank & Trust may require specific disclosures that should be reconciled with these documents.

Budget 2-4 hours of attorney time before publication. A fintech-savvy solo or small-firm privacy attorney will typically charge $400-$800/hour; expect $1,500-$3,000 total for a final review pass. That is cheap insurance for the first paying Nonprofit.

---

## Placeholders to Fill In

These documents contain bracketed placeholders. Replace every one before publication.

- [ ] `[BENEFITSSAFE MAILING ADDRESS — Oakland, CA]` — full street address (appears in Privacy Policy §16, Terms §19.3 and §20, DPA signature block)
- [ ] `[BENEFITSSAFE PHONE NUMBER]` — toll-free or local number for CCPA requests (Privacy Policy §7.2, §16)
- [ ] `[EU REPRESENTATIVE — to be appointed if we have substantial EU user base under GDPR Art. 27]` — only required if targeting EU users without an EU establishment; delete the line if not applicable
- [ ] `[PRINCIPAL NAME]` and `[TITLE]` — BenefitsSafe signatory for the DPA signature block
- [ ] `[status.benefitssafe.com]` — confirm the status-page URL or remove the reference (Terms §10)
- [ ] `benefitssafe.com/subprocessors` — confirm this page exists or remove the reference (DPA Appendix A footer)
- [ ] `benefitssafe.com/security` — confirm the security page exists (Privacy Policy §10, DPA §4.7)
- [ ] **SOC 2 language** — today the docs say "on our roadmap." Update when actually certified.

---

## Publication Steps

### Privacy Policy

- [ ] Publish at **benefitssafe.com/privacy** (marketing site) and **app.benefitssafe.com/privacy** (app — already in `PUBLIC_PATHS` of middleware)
- [ ] Add a footer link on every page of both the marketing site and the app
- [ ] Make sure the app's `/privacy` route renders the same version that's in the repo (consider sourcing the markdown directly so they can't drift)
- [ ] Create `privacy@benefitssafe.com` email alias, routed to the designated Privacy Officer
- [ ] Set up a shared inbox or ticketing queue so privacy requests are not buried in one person's mailbox
- [ ] Document internal SLA: 30 days for GDPR, 45 days for CCPA

### Terms of Service

- [ ] Publish at **benefitssafe.com/terms** and **app.benefitssafe.com/terms**
- [ ] Add TOS acceptance checkbox to the signup form — text: *"I have read and agree to the [Terms of Service](https://benefitssafe.com/terms) and [Privacy Policy](https://benefitssafe.com/privacy)"*
- [ ] Record each Nonprofit's acceptance: user ID, timestamp, IP address, terms version. Store in an append-only table (e.g., `TermsAcceptance`).
- [ ] Add a check so new versions of the Terms trigger a re-acceptance prompt at next login
- [ ] Create `legal@benefitssafe.com` email alias for legal notices and arbitration opt-outs
- [ ] Prepare an arbitration opt-out log: any opt-out received must be acknowledged in writing within 5 days and stored in the corresponding Nonprofit's account

### Data Processing Agreement

- [ ] Publish at **benefitssafe.com/dpa**
- [ ] Also expose a downloadable PDF at /legal/dpa.pdf (render from the markdown)
- [ ] Send the DPA link to every pilot Nonprofit client proactively — don't wait for them to ask during procurement
- [ ] For Nonprofits that require a countersigned DPA (most funded or government-affiliated orgs will), prepare a standard countersigned template so turnaround is hours, not weeks
- [ ] Create `dpa@benefitssafe.com` alias or route to privacy@ — decide one and be consistent
- [ ] Maintain the current Sub-processor list (DPA Appendix A) at **benefitssafe.com/subprocessors**
- [ ] Decide how Sub-processor change notices will be sent: email to the privacy contact on file is the baseline

---

## Internal Infrastructure

### Email Aliases to Create

- [ ] **privacy@benefitssafe.com** — privacy inquiries, CCPA/GDPR requests
- [ ] **security@benefitssafe.com** — vulnerability reports, suspected account compromise
- [ ] **legal@benefitssafe.com** — legal notices, arbitration opt-outs, disputes
- [ ] **dpa@benefitssafe.com** (or alias to privacy@) — procurement inquiries about the DPA
- [ ] **compliance@benefitssafe.com** (optional) — for regulatory and funder questions

Route all five to a human who checks daily, not a black hole.

### Incident Response Readiness

- [ ] Document the 24-hour Customer-notification workflow (DPA §7) and run a tabletop: who gets paged, who drafts the notice, who approves, who sends
- [ ] Prepare a Breach-notification template for Nonprofits to use when notifying Beneficiaries (California Civil Code §1798.82 content requirements)
- [ ] Map GDPR 72-hour supervisory-authority notification path: identify the lead DPA (usually the Nonprofit's, since BenefitsSafe is the Processor — Customer does the filing with our cooperation)
- [ ] Keep `docs/incident-response-plan.md` up to date and cross-referenced from the DPA

### Data Subject Request Handling

- [ ] Build or confirm self-service UX for Beneficiaries to export / request deletion through the Nonprofit's dashboard
- [ ] Create an internal runbook for "CCPA request received by BenefitsSafe directly" — the DPA says we forward to the Nonprofit; make sure someone actually does
- [ ] Track request timelines in a shared queue so no request ages past the SLA

### Sub-processor Management

- [ ] Maintain a live list at **benefitssafe.com/subprocessors** that mirrors DPA Appendix A
- [ ] Subscribe to each Sub-processor's DPA-update notifications
- [ ] Before adding a new Sub-processor, draft a 30-day notice email template; queue it ahead of the deployment that switches traffic
- [ ] Keep copies of each Sub-processor's current DPA in `docs/legal/subprocessors/` (not public, available on Customer request)

### Consent and Analytics

- [ ] Confirm that the only cookies set in production are the ones listed in Privacy Policy §9. If analytics or behavioral tools are added, introduce a consent banner and update the policy.
- [ ] If Google Analytics 4 or similar is introduced, disclose it in the Privacy Policy AND implement IP anonymization + a 14-month retention window at most.
- [ ] Audit localStorage / sessionStorage usage for anything that resembles tracking and include it in §9 before launch.

---

## Regulatory & Reporting Touchpoints

- [ ] **California Privacy Protection Agency** — confirm we are not a "data broker" under California AB 1202 (we are not, because we collect from Nonprofits with a direct relationship). Re-check every 12 months.
- [ ] **IRS recordkeeping** — ensure the 7-year retention policy is technically enforced, not just documented
- [ ] **OFAC** — maintain written policy for OFAC screening cadence, match-escalation, and recordkeeping (tie into the Compliance Engine)
- [ ] **FinCEN / BSA** — confirm with counsel whether BenefitsSafe has any direct BSA obligations or whether they flow through Stripe + partner banks (likely the latter for the current service model)
- [ ] **State money-transmitter analysis** — our model routes funds through Stripe and FDIC member banks; a formal memo from counsel confirming we are not a money transmitter in California and any high-volume states (NY, TX, WA, FL, MA) is strongly recommended before onboarding the first paying client

---

## Demo / Procurement Readiness

- [ ] Rehearse answering these three questions a Nonprofit procurement officer will ask:
  1. "Where is our Beneficiary data stored, and who has access?" → Privacy Policy §6, DPA Appendix A
  2. "What happens if you have a data breach?" → Privacy Policy §11, DPA §7
  3. "Can we audit your security?" → DPA §8
- [ ] Prepare a one-page procurement summary ("Security & Privacy at a Glance") that links into all three documents — procurement teams love these
- [ ] Have the following ready as attachments: current penetration-test executive summary, current insurance certificate (cyber + E&O), evidence of background-check policy, org chart of Sub-processors

---

## Versioning and Ongoing Hygiene

- [ ] Every document update must bump the Version number and Effective Date in the header + Version History table
- [ ] Send the 30-day notice to active Nonprofits before any material change takes effect
- [ ] Maintain a changelog at the bottom of each document
- [ ] Re-review all three documents at least annually; sooner if a new state privacy law takes effect or an EU transfer framework changes
- [ ] Track these documents in git (they already are); require PR review for any edit

---

## Done When

- All three documents are publicly accessible at the URLs promised in this checklist
- Footer links exist on the marketing site and inside the app
- TOS acceptance is captured on signup with user, timestamp, IP, and version
- The four email aliases exist and a human checks them daily
- The incident-response tabletop has been run at least once
- Counsel has reviewed the final published version

Until every box is checked, consider onboarding paid Nonprofits a soft-launch with extra operational attention, not a scalable go-to-market.
