# BenefitsSafe Incident Response Plan (IRP)

**Version:** 1.0
**Effective Date:** April 1, 2026
**Owner:** BenefitsSafe Security Team
**Review Cycle:** Quarterly (or after every incident)

---

## 1. Purpose

This plan establishes procedures for detecting, responding to, containing, and recovering from security incidents affecting the BenefitsSafe platform. It covers data breaches, unauthorized access, system compromise, fraud, denial-of-service, and any event that threatens the confidentiality, integrity, or availability of user data or financial operations.

BenefitsSafe handles sensitive financial and benefit program data (SSI, SSDI, Medi-Cal) for vulnerable populations. Rapid, structured incident response is critical to prevent harm to beneficiaries, nonprofits, and their data.

---

## 2. Scope

This plan applies to:
- All BenefitsSafe production systems (Next.js application, API routes, databases)
- AWS infrastructure (RDS PostgreSQL, S3, Secrets Manager, CloudFront)
- Stripe integration (Treasury, Issuing, Connect, webhooks)
- Third-party services (Google OAuth, Microsoft Entra ID, Anthropic AI, Sentry)
- All user data across all roles (nonprofit admins, beneficiaries, vendors, auditors, attorneys)

---

## 3. Incident Severity Levels

| Level | Definition | Response Time | Examples |
|-------|-----------|---------------|----------|
| **SEV-1 (Critical)** | Active breach, data exfiltration, or financial loss in progress | **15 minutes** | Database breach, stolen session tokens with active use, unauthorized card transactions, ransomware |
| **SEV-2 (High)** | Confirmed vulnerability being exploited or imminent threat | **1 hour** | SQL injection discovered in production, compromised admin credentials, Stripe webhook signature bypass |
| **SEV-3 (Medium)** | Vulnerability discovered but no evidence of exploitation | **4 hours** | OWASP finding in code review, dependency CVE with known exploit, suspicious login patterns |
| **SEV-4 (Low)** | Minor security issue, no immediate risk | **24 hours** | Failed penetration test finding (low severity), informational CVE, policy violation |

---

## 4. Incident Response Team

| Role | Responsibility |
|------|---------------|
| **Incident Commander (IC)** | Leads response, makes containment decisions, coordinates communication |
| **Technical Lead** | Investigates root cause, implements fixes, manages infrastructure |
| **Communications Lead** | Drafts notifications to affected users, regulators, and partners |
| **Legal / Compliance** | Assesses regulatory notification requirements (CCPA, state breach laws) |
| **Stripe Liaison** | Coordinates with Stripe support for card/Treasury incidents |

For the current team size (solo founder), all roles are held by the founder until the team grows. As the team scales, roles should be assigned to specific individuals with documented escalation paths.

---

## 5. Incident Response Phases

### Phase 1: Detection and Identification

**Automated Detection Sources:**
- Sentry error monitoring and alerting
- AWS CloudTrail (API activity logs)
- AWS Security Hub (security findings)
- Stripe webhook anomaly alerts
- Session fingerprint mismatch alerts (`x-session-suspicious` header)
- Rate limiting triggers (failed login attempts)
- Audit log anomalies (unusual admin actions)

**Manual Detection Sources:**
- User reports via support@benefitssafe.com
- Security researcher disclosures
- Code review findings
- Dependency vulnerability scans (`npm audit`)

**Identification Checklist:**
- [ ] What systems/data are affected?
- [ ] Is the incident ongoing or contained?
- [ ] What is the estimated blast radius (number of users, orgs, records)?
- [ ] Is financial data (card numbers, bank info) involved?
- [ ] Is benefit program data (SSI/SSDI status, SSN last 4) involved?
- [ ] Assign severity level (SEV-1 through SEV-4)

### Phase 2: Containment

**Immediate Containment (SEV-1 and SEV-2):**

1. **Session compromise:** Rotate `AUTH_SECRET` in AWS Secrets Manager to invalidate all sessions. All users will need to re-authenticate.

2. **Database breach:** 
   - Revoke compromised database credentials immediately
   - Rotate RDS master password via AWS Console
   - Enable RDS snapshot for forensic preservation
   - Review and restrict Security Group inbound rules

3. **Compromised admin account:**
   - Disable the user account (`isActive = false`)
   - Invalidate their sessions (rotate secret or clear specific tokens)
   - Review audit log for actions taken by the compromised account
   - Check for unauthorized team member additions or role changes

4. **Unauthorized card transactions:**
   - Contact Stripe support to freeze affected cardholder(s)
   - Cancel compromised virtual cards via Stripe API
   - Review webhook logs for authorization patterns
   - Block suspicious merchant categories

5. **S3 data exposure:**
   - Set bucket policy to deny all public access
   - Review CloudTrail S3 data events for unauthorized GetObject calls
   - Identify and catalog exposed files
   - Rotate any exposed credentials found in documents

6. **API key/secret compromise:**
   - Rotate the compromised key immediately in AWS Secrets Manager
   - Deploy updated environment variables
   - Review usage logs for the compromised key
   - Check for unauthorized API calls during the exposure window

### Phase 3: Eradication

- Identify and fix the root cause (code vulnerability, misconfiguration, credential leak)
- Deploy the fix to production
- Run `npm audit` to verify no new vulnerabilities introduced
- Run OWASP ZAP scan against the fix
- Verify the attack vector is no longer exploitable
- Update WAF rules if applicable

### Phase 4: Recovery

- Restore any affected data from backups (RDS automated snapshots)
- Re-enable suspended services or accounts
- Monitor systems closely for 72 hours post-recovery
- Verify Stripe card operations are functioning normally
- Confirm all rotated credentials are working
- Validate audit log integrity (immutable logs should show complete timeline)

### Phase 5: Post-Incident Review

Conduct within **72 hours** of incident resolution:

- [ ] **Timeline:** Document what happened, minute by minute
- [ ] **Root Cause:** What was the vulnerability? How did it get into production?
- [ ] **Detection:** How was it detected? Could we have detected it sooner?
- [ ] **Response:** Was the response timely? What worked? What didn't?
- [ ] **Impact:** How many users/orgs/records were affected?
- [ ] **Remediation:** What changes were made? Are they sufficient?
- [ ] **Prevention:** What processes, tools, or controls will prevent recurrence?
- [ ] **Action Items:** Assign owners and deadlines for each improvement

---

## 6. Notification Requirements

### California Consumer Privacy Act (CCPA)

- **When:** Breach of unencrypted personal information of California residents
- **Who:** All affected California residents
- **How:** Written notice or email within the most expedient time possible without unreasonable delay
- **Content:** What happened, what information was involved, what we're doing about it, contact information
- **Attorney General:** Required if breach affects 500+ California residents (submit via CA DOJ portal)

### Stripe

- **When:** Any incident involving Stripe-processed data, card numbers, or financial account information
- **How:** Contact Stripe support immediately; follow their incident reporting process
- **Timeline:** As soon as possible after discovery

### AWS

- **When:** If the incident involves AWS infrastructure compromise
- **How:** AWS Abuse Report + AWS Support ticket
- **Timeline:** Immediately

### Regulatory Bodies

| Trigger | Agency | Timeline |
|---------|--------|----------|
| 500+ CA residents affected | CA Attorney General | Without unreasonable delay |
| Financial data breach | Relevant state financial regulator | Per state law |
| Card data compromise | PCI SSC + Stripe | Immediately |

### User Notification Template

```
Subject: Important Security Notice from BenefitsSafe

Dear [User Name],

We are writing to inform you of a security incident that may have affected 
your BenefitsSafe account.

WHAT HAPPENED:
[Brief, clear description]

WHAT INFORMATION WAS INVOLVED:
[Specific data types affected]

WHAT WE ARE DOING:
[Steps taken to address the incident]

WHAT YOU CAN DO:
- Change your password immediately at [link]
- Enable MFA if not already active
- Review your recent account activity
- Contact us with any concerns

We sincerely apologize for this incident and are committed to protecting 
your information.

BenefitsSafe Security Team
security@benefitssafe.com
```

---

## 7. Communication Channels

| Channel | Use |
|---------|-----|
| security@benefitssafe.com | Inbound reports and outbound notifications |
| Sentry Dashboard | Real-time error monitoring |
| AWS Console | Infrastructure investigation and containment |
| Stripe Dashboard | Payment/card incident investigation |
| Audit Logs (in-app) | User activity forensics |

---

## 8. Evidence Preservation

During any SEV-1 or SEV-2 incident:

1. **Do NOT** delete or modify logs, database records, or S3 objects related to the incident
2. Take RDS snapshots before any remediation changes
3. Export relevant CloudTrail logs to a separate, locked S3 bucket
4. Screenshot Stripe dashboard findings
5. Preserve complete audit log entries for the incident timeframe
6. Document all actions taken with timestamps

Audit logs and ledger entries are immutable by design and cannot be altered.

---

## 9. Key Contacts

| Contact | Purpose | Details |
|---------|---------|---------|
| Stripe Support | Card/Treasury incidents | dashboard.stripe.com/support |
| AWS Support | Infrastructure incidents | AWS Console support center |
| CA Attorney General | Breach reporting (500+) | oag.ca.gov/privacy/databreach/reporting |
| Legal Counsel | Regulatory guidance | [To be assigned] |
| Cyber Insurance | Claim filing | [To be assigned when policy obtained] |

---

## 10. Annual Review Checklist

- [ ] Review and update this plan (quarterly minimum)
- [ ] Conduct a tabletop incident simulation
- [ ] Verify all contact information is current
- [ ] Confirm AWS CloudTrail is active and logs are retained
- [ ] Confirm Sentry alerting rules are functional
- [ ] Run penetration test (OWASP ZAP or equivalent)
- [ ] Review and rotate all secrets (AUTH_SECRET, ENCRYPTION_KEY, API keys)
- [ ] Verify RDS automated backups are running
- [ ] Review S3 bucket policies and access logs
- [ ] Update team roles as organization grows

---

## 11. Related Documents

- [Privacy Policy](/privacy) — CCPA/CPRA data rights and breach notification obligations
- [Terms of Service](/terms) — User responsibilities and liability
- OWASP Top 10:2021 — https://owasp.org/Top10/
- NIST Cybersecurity Framework — https://www.nist.gov/cyberframework
- SOC 2 Trust Service Criteria — https://us.aicpa.org/interestareas/frc/assuranceadvisoryservices/trustservicescriteria
- PCI DSS v4.0 — https://www.pcisecuritystandards.org/

---

*This document is confidential and intended for internal use by the BenefitsSafe security team. Unauthorized distribution is prohibited.*
