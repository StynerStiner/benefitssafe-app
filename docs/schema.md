# BenefitsSafe Database Schema

> Auto-generated from prisma/schema.prisma. Last updated: 2026-04-08.

## Overview

- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma
- **Generator output**: `../lib/generated/prisma`
- **Total models**: 25
- **Total enums**: 15
- **Design principles**: Multi-tenant (organizationId scoping), immutable audit/ledger records, soft deletes (archivedAt), Decimal(12,2) for all money fields

---

## Models

### Organization
**Purpose:** Multi-tenant root entity representing a nonprofit using BenefitsSafe. Every query is scoped to an organization.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| name | String | Organization name |
| ein | String? | Tax ID (EIN) |
| orgCode | String? @unique | Human-readable org identifier, e.g. "ORG-00001" |
| einVerified | Boolean (default: false) | Whether EIN was verified via IRS/ProPublica lookup |
| address | String? | Mailing address |
| phone | String? | Contact phone number |
| website | String? | Organization website URL |
| stripeAccountId | String? | Stripe Connect account ID |
| stripeFinancialAccountId | String? | Stripe Treasury Financial Account ID |
| plaidItemId | String? | Plaid bank connection ID |
| logoUrl | String? | Organization logo image URL |
| trialStartDate | DateTime? | When the free trial began |
| trialEndDate | DateTime? | When the free trial ends |
| subscriptionStatus | String (default: "trial") | Subscription state: trial, active, expired, suspended |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Has many `User[]`
- Has many `Grant[]`
- Has many `Vendor[]`
- Has many `VirtualCard[]`
- Has many `DisbursementPolicy[]`
- Has many `PromoRedemption[]`
- Has many `CardholderEligibility[]`
- Has many `CalendarEvent[]`
- Has many `OrganizationMembership[]`
- Has many `Integration[]`
- Has many `WorkflowTrigger[]`
- Has many `WorkflowLog[]`
- Has one `BillingSubscription?`
- Has many `UsageCounter[]`

**Indexes:** None (primary key only).

---

### User
**Purpose:** Represents any person in the system. Role determines portal access. Beneficiary-specific profile fields store sensitive data for SSI/SSDI/Medi-Cal recipients.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| email | String @unique | Login email address |
| firstName | String | First name |
| lastName | String | Last name |
| phone | String? | Phone number |
| passwordHash | String? | Hashed password for credentials auth |
| avatarUrl | String? | Profile image URL |
| role | UserRole (enum) | User's role in the system |
| organizationId | String | FK to Organization |
| isActive | Boolean (default: true) | Whether account is active |
| emailVerified | Boolean (default: false) | Whether email has been verified |
| emailVerifyToken | String? @unique | One-time email verification token |
| emailVerifyExpiry | DateTime? | When the verification token expires |
| mfaEnabled | Boolean (default: false) | Whether TOTP MFA is turned on |
| mfaSecret | String? | Encrypted TOTP secret key |
| mfaBackupCodes | String[] | Array of hashed recovery codes |
| lastLoginIp | String? | IP address of last login |
| lastLoginUserAgent | String? | User-Agent string of last login |
| lastLoginAt | DateTime? | Timestamp of last login |
| trustedDevices | Json? | Array of { ip, userAgent, firstSeen, lastSeen } |
| beneficiaryCode | String? @unique | Human-readable beneficiary ID, e.g. "BS-0001-00042" |
| dateOfBirth | DateTime? | Beneficiary date of birth |
| addressStreet | String? | Beneficiary street address |
| addressCity | String? | Beneficiary city |
| addressState | String? | Beneficiary state |
| addressZip | String? | Beneficiary ZIP code |
| ssnLast4 | String? | Last 4 of SSN -- encrypted at app level, NEVER in API list responses |
| benefitPrograms | Json? | Object: { ssi: bool, ssdi: bool, mediCal: bool, ... } |
| emergencyContactName | String? | Emergency contact full name |
| emergencyContactPhone | String? | Emergency contact phone |
| notes | String? | Admin notes about this user |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId)
- Has many `ExpenseRequest[]`
- Has many `Approval[]`
- Has many `Grant[]` (named relation "GrantBeneficiary")
- Has many `Vendor[]`
- Has many `InviteToken[]`
- Has one `CardholderEligibility?`
- Has many `OrganizationMembership[]`
- Has many `VirtualCard[]` (named relation "CardBeneficiary")

**Indexes:**
- `@@index([organizationId])`
- `@@index([email])`

---

### InviteToken
**Purpose:** One-time-use token for inviting users to the platform. Supports email invites and shareable links.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | FK to User being invited |
| token | String @unique (default: uuid()) | The invite token value |
| sentTo | String? | Email address the invite was sent to |
| method | String? | Delivery method: "email" or "link" |
| sentById | String? | User ID of the admin who sent the invite |
| expiresAt | DateTime | When the token expires |
| usedAt | DateTime? | When the token was used (null = unused) |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Relations:**
- Belongs to `User` (via userId)

**Indexes:**
- `@@index([token])`
- `@@index([userId])`

---

### Grant
**Purpose:** Represents a restricted grant with a three-party model (issuer, receiver org, beneficiary). Tracks budget, spending, and compliance controls.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization (the grant receiver) |
| grantIssuerName | String | Name of the foundation/funder who awarded the grant |
| grantIssuerContact | String? | Contact info for the grant issuer |
| beneficiaryId | String? | FK to User -- the intended beneficiary |
| name | String | Grant name/title |
| description | String? | Grant description |
| totalAmount | Decimal(12,2) | Total grant amount |
| spentAmount | Decimal(12,2) (default: 0) | Amount spent so far |
| remainingAmount | Decimal(12,2) | Remaining balance |
| status | GrantStatus (default: ACTIVE) | Grant lifecycle status |
| startDate | DateTime | Grant start date |
| endDate | DateTime? | Grant end date (optional) |
| restrictions | String? | Free-text grant restrictions |
| benefitFlags | Json? | Object: { ssi: bool, ssdi: bool, mediCal: bool, medicaid: bool, able: bool } |
| grantDocumentText | String? | Extracted text from uploaded PDF or pasted grant document |
| grantDocumentName | String? | Original filename of uploaded grant document |
| purpose | String? | What the grant funds are for |
| funderRequirements | Json? | Legal/compliance rules from the funder |
| approvedMCCs | Json? | JSON array of allowed MCC codes |
| blockedMCCs | Json? | JSON array of blocked MCC codes |
| whitelistedVendorIds | Json? | JSON array of vendor IDs allowed for this grant |
| archivedAt | DateTime? | Soft delete timestamp |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId)
- Belongs to `User?` as beneficiary (named relation "GrantBeneficiary", via beneficiaryId)
- Has many `BudgetCategory[]`
- Has many `ExpenseRequest[]`

**Indexes:**
- `@@index([organizationId])`
- `@@index([beneficiaryId])`
- `@@index([organizationId, status])` -- Grant listing filtered by org and status

---

### BudgetCategory
**Purpose:** A budget line item within a grant. Each category has its own allocation and spend tracking.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| grantId | String | FK to Grant |
| name | String | Category name, e.g. "Editing", "Subscriptions", "Travel" |
| allocatedAmount | Decimal(12,2) | Budget allocated to this category |
| spentAmount | Decimal(12,2) (default: 0) | Amount spent in this category |
| cardMode | CardMode (default: SINGLE_CARD) | Whether to use one card or per-vendor cards |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Grant` (via grantId)
- Has many `ExpenseRequest[]`
- Has many `VirtualCard[]`

**Indexes:**
- `@@index([grantId])`

---

### ExpenseRequest
**Purpose:** A request to spend grant funds. Runs through the compliance engine for risk classification before entering the approval queue.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| grantId | String | FK to Grant |
| categoryId | String | FK to BudgetCategory |
| requestedById | String | FK to User who submitted the request |
| vendorId | String? | FK to Vendor (linked by admin) |
| description | String | What the expense is for |
| amount | Decimal(12,2) | Requested amount |
| frequency | ExpenseFrequency (default: ONE_TIME) | Payment frequency |
| expenseType | String | Type: "subscription", "invoice", "equipment", etc. |
| vendorName | String? | Vendor name provided by beneficiary |
| vendorEmail | String? | Vendor email provided by beneficiary |
| vendorPhone | String? | Vendor phone provided by beneficiary |
| vendorWebsite | String? | Vendor website provided by beneficiary |
| riskClassification | RiskLevel (default: PENDING) | Compliance engine risk result |
| riskNotes | String? | Compliance engine notes |
| policyViolations | Json? | Array of policy violations if any |
| status | ExpenseStatus (default: PENDING) | Approval workflow status |
| approvedById | String? | User ID who approved |
| approvedAt | DateTime? | When approved |
| rejectedReason | String? | Reason for rejection |
| suggestedCategory | String? | Beneficiary-suggested category (when selecting "Other / Suggest New") |
| receiptUrl | String? | URL to uploaded receipt |
| invoiceUrl | String? | URL to uploaded invoice |
| archivedAt | DateTime? | Soft delete timestamp |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Grant` (via grantId)
- Belongs to `BudgetCategory` (via categoryId)
- Belongs to `User` (via requestedById)
- Belongs to `Vendor?` (via vendorId)
- Has many `Approval[]`
- Has many `LedgerEntry[]`
- Has many `VirtualCard[]`

**Indexes:**
- `@@index([grantId])`
- `@@index([requestedById])`
- `@@index([status])`
- `@@index([grantId, status])` -- Expense queries by grant and status
- `@@index([requestedById, status])` -- Expense queries by requester and status
- `@@index([grantId, status, createdAt])` -- Expense filtering by grant, status, and date range

---

### Vendor
**Purpose:** An external vendor/service provider that receives payments on behalf of beneficiaries. Vendors go through an approval workflow.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| userId | String? | FK to User if vendor has a user account |
| name | String | Vendor business name |
| vendorCode | String? @unique | Human-readable vendor ID, e.g. "VN-0001-00001" |
| type | VendorType (enum) | Vendor classification |
| email | String? | Contact email |
| phone | String? | Contact phone |
| website | String? | Website URL |
| address | String? | Business address |
| paymentMethod | String? | Payment method: "ach", "card", "check" |
| stripePaymentMethodId | String? | Stripe-managed payment method ID |
| status | VendorStatus (default: PENDING) | Approval workflow status |
| approvedAt | DateTime? | When vendor was approved |
| taxIdCollected | Boolean (default: false) | Whether tax ID (W-9) has been collected |
| form1099Required | Boolean (default: false) | Whether 1099 is required for this vendor |
| archivedAt | DateTime? | Soft delete timestamp |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId)
- Belongs to `User?` (via userId)
- Has many `ExpenseRequest[]`
- Has many `Subscription[]`
- Has many `VirtualCard[]`

**Indexes:**
- `@@index([organizationId])`
- `@@index([organizationId, status])` -- Vendor approval workflow queries

---

### Subscription
**Purpose:** A recurring vendor subscription (e.g. Adobe Creative Cloud) managed and paid on behalf of a beneficiary. Separate from BillingSubscription which is the platform's own billing.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| vendorId | String | FK to Vendor |
| grantId | String | Grant funding this subscription |
| categoryId | String | Budget category this subscription draws from |
| serviceName | String | Service name, e.g. "Adobe Creative Cloud" |
| loginEmail | String | Email used for the subscription account |
| monthlyCost | Decimal(10,2) | Monthly cost of the subscription |
| billingCycle | String | "monthly" or "annual" |
| renewalDate | DateTime? | Next renewal date |
| cardId | String? | FK to VirtualCard assigned to this subscription |
| billingUpdateStatus | BillingUpdateStatus (default: PENDING) | Card billing update workflow status |
| billingUpdatedAt | DateTime? | When billing was last updated |
| status | SubscriptionStatus (default: ACTIVE) | Subscription lifecycle status |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Vendor` (via vendorId)
- Belongs to `VirtualCard?` (via cardId)

**Indexes:**
- `@@index([vendorId])`
- `@@index([grantId])`
- `@@index([grantId, status])` -- Subscription queries by grant and status
- `@@index([vendorId, status])` -- Subscription queries by vendor and status

---

### VirtualCard
**Purpose:** A Stripe Issuing virtual card issued for a specific expense, vendor, or budget category. Can be one-time, monthly, or custom.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| categoryId | String? | FK to BudgetCategory |
| expenseId | String? | FK to ExpenseRequest this card was issued for |
| vendorId | String? | FK to Vendor this card is locked to |
| beneficiaryId | String? | FK to User who uses this card |
| stripeCardId | String @unique | Stripe Issuing card ID |
| last4 | String | Last 4 digits of card number |
| expirationMonth | Int | Card expiration month |
| expirationYear | Int | Card expiration year |
| spendingCap | Decimal(10,2)? | Maximum spending limit |
| merchantLock | String? | Locked to specific merchant if applicable |
| cardType | String (default: "one_time") | Card type: "one_time", "monthly", "custom" |
| cardLabel | String? | Human-readable label, e.g. "Writing Supplies Card" |
| status | CardStatus (default: ACTIVE) | Card lifecycle status |
| expiresAt | DateTime? | Custom expiration date |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId)
- Belongs to `BudgetCategory?` (via categoryId)
- Belongs to `ExpenseRequest?` (via expenseId)
- Belongs to `Vendor?` (via vendorId)
- Belongs to `User?` as beneficiary (named relation "CardBeneficiary", via beneficiaryId)
- Has many `Subscription[]`
- Has many `Transaction[]`

**Indexes:**
- `@@index([organizationId])`
- `@@index([expenseId])`
- `@@index([vendorId])`
- `@@index([beneficiaryId])`
- `@@index([stripeCardId])`
- `@@index([organizationId, status])` -- Card listing filtered by org and status

---

### CardholderEligibility
**Purpose:** Tracks whether a beneficiary is eligible for a card based on legal/criminal background and OFAC sanctions screening.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| beneficiaryId | String @unique | FK to User (one-to-one) |
| organizationId | String | FK to Organization |
| hasActiveWarrant | Boolean (default: false) | Whether beneficiary has an active warrant |
| isCurrentlyIncarcerated | Boolean (default: false) | Whether beneficiary is currently incarcerated |
| hasDrugTraffickingConviction | Boolean (default: false) | Whether beneficiary has a drug trafficking conviction |
| probationParoleRestrictions | String? | Description of probation/parole restrictions |
| eligibilityStatus | EligibilityStatus (default: PENDING_VERIFICATION) | Computed eligibility result |
| ofacScreened | Boolean (default: false) | Whether OFAC sanctions screening was performed |
| ofacMatchFound | Boolean (default: false) | Whether an OFAC match was found |
| ofacScreenedAt | DateTime? | When OFAC screening was last run |
| ofacMatches | Json? | Array of OFAC match results |
| verifiedBy | String? | User ID who verified the eligibility |
| verifiedAt | DateTime? | When eligibility was verified |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `User` (via beneficiaryId, one-to-one)
- Belongs to `Organization` (via organizationId)

**Indexes:**
- `@@index([organizationId])`
- `@@index([beneficiaryId])`

---

### Transaction
**Purpose:** Records individual card transactions from Stripe Issuing webhooks. Tracks spending against cards, grants, and expenses.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | Organization ID for tenant scoping |
| cardId | String | FK to VirtualCard |
| stripeTransactionId | String @unique | Stripe transaction ID |
| amount | Decimal(10,2) | Transaction amount |
| merchantName | String | Name of the merchant |
| merchantCategory | String? | Merchant category code/description |
| status | String | Transaction status: "pending", "completed", "declined" |
| declinedReason | String? | Reason if transaction was declined |
| grantId | String? | Grant ID for ledger tracking |
| expenseId | String? | Expense ID for expense tracking |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Relations:**
- Belongs to `VirtualCard` (via cardId)

**Indexes:**
- `@@index([cardId])`
- `@@index([organizationId])`
- `@@index([cardId, createdAt])` -- Transaction history by card
- `@@index([organizationId, createdAt])` -- Transaction history time-series queries

---

### LedgerEntry
**Purpose:** IMMUTABLE double-entry ledger for restricted fund accounting. Records are never updated or deleted. Provides audit trail for every financial movement.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| grantId | String | Grant this entry belongs to |
| categoryId | String? | Budget category ID |
| expenseId | String? | FK to ExpenseRequest |
| type | LedgerType (enum) | CREDIT or DEBIT |
| amount | Decimal(12,2) | Entry amount |
| balanceAfter | Decimal(12,2) | Running balance after this entry |
| description | String | Human-readable description |
| reference | String? | External reference (transaction ID, invoice number, etc.) |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Note:** No `updatedAt` field. Ledger entries are IMMUTABLE -- never modified or deleted.

**Relations:**
- Belongs to `ExpenseRequest?` (via expenseId)

**Indexes:**
- `@@index([grantId])`
- `@@index([expenseId])`
- `@@index([grantId, createdAt])` -- Monthly reconciliation queries at scale

---

### Approval
**Purpose:** Records individual approval/rejection actions on expense requests. Multiple approvers can act on the same expense.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| expenseId | String | FK to ExpenseRequest |
| approverId | String | FK to User who took action |
| action | ApprovalAction (enum) | APPROVED, REJECTED, or REQUESTED_INFO |
| notes | String? | Approver's notes |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Relations:**
- Belongs to `ExpenseRequest` (via expenseId)
- Belongs to `User` (via approverId)

**Indexes:**
- `@@index([expenseId])`

---

### AuditLog
**Purpose:** IMMUTABLE audit trail. Every data mutation creates an entry. Records are never updated or deleted. Used for compliance reporting and forensic investigation.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | User who performed the action |
| organizationId | String | Organization context |
| action | String | Action type: "create", "update", "delete", "approve", "reject" |
| entityType | String | Entity type: "grant", "expense", "vendor", "card", etc. |
| entityId | String | ID of the affected entity |
| oldValue | Json? | Previous state (for updates) |
| newValue | Json? | New state (for creates/updates) |
| ipAddress | String? | IP address of the actor |
| userAgent | String? | User-Agent string of the actor |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Note:** No `updatedAt` field. Audit logs are IMMUTABLE -- never modified or deleted.

**Indexes:**
- `@@index([organizationId])`
- `@@index([entityType, entityId])`
- `@@index([userId, organizationId])` -- Audit queries by user within an org
- `@@index([organizationId, createdAt])` -- Audit trail time-series queries

---

### Conversation
**Purpose:** A messaging thread between users within an organization. Supports direct messages, department channels, and support threads.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | Organization scope |
| subject | String? | Conversation subject/title |
| type | String (default: "direct") | Type: "direct", "department", "support" |
| department | String? | Department: "grants", "compliance", "support", etc. |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Has many `ConversationParticipant[]`
- Has many `Message[]`

**Indexes:**
- `@@index([organizationId])`

---

### ConversationParticipant
**Purpose:** Junction model linking users to conversations. Tracks read state per participant.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| conversationId | String | FK to Conversation |
| userId | String | FK to User |
| role | String (default: "member") | Participant role: "member" or "admin" |
| lastReadAt | DateTime (default: now()) | Last time participant read the conversation |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Relations:**
- Belongs to `Conversation` (via conversationId)

**Unique constraints:**
- `@@unique([conversationId, userId])`

**Indexes:**
- `@@index([userId])`

---

### Message
**Purpose:** Individual message within a conversation.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| conversationId | String | FK to Conversation |
| senderId | String | User ID of the sender |
| content | String | Message body text |
| attachmentUrl | String? | URL to attached file |
| attachmentName | String? | Original filename of attachment |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Relations:**
- Belongs to `Conversation` (via conversationId)

**Indexes:**
- `@@index([conversationId, createdAt])`
- `@@index([senderId])`

---

### Notification
**Purpose:** System notifications delivered to users (expense submitted, approved, rejected, card issued, etc.).

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | FK to User who receives this notification |
| organizationId | String | Organization context |
| type | String | Notification type: expense_submitted, expense_approved, expense_rejected, vendor_profile_complete, invite_accepted, card_issued |
| title | String | Notification title |
| message | String | Notification body text |
| entityType | String? | Related entity type: grant, expense, vendor, user |
| entityId | String? | Related entity ID |
| href | String? | Link to navigate to |
| read | Boolean (default: false) | Whether the notification has been read |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Indexes:**
- `@@index([userId, read])`
- `@@index([organizationId, createdAt])` -- Notification queries by org and date

---

### Document
**Purpose:** File attachments (receipts, invoices, contracts, grant letters) stored in S3 and linked to entities.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | Organization scope |
| entityType | String | Parent entity type: "expense", "vendor", "grant" |
| entityId | String | Parent entity ID |
| fileName | String | Original file name |
| fileUrl | String | S3 storage URL |
| fileType | String | Document type: "receipt", "invoice", "contract", "grant_letter" |
| uploadedById | String | User ID who uploaded the file |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Indexes:**
- `@@index([organizationId])`
- `@@index([entityType, entityId])`

---

### DisbursementPolicy
**Purpose:** Organization-level (or grant-level) rules governing what types of disbursements are allowed, require review, or are blocked. Also configures auto-approval thresholds.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| grantId | String? | FK to Grant (null = applies to all grants for this org) |
| cashToRecipient | PolicySetting (default: DISALLOWED) | Policy for cash payments to beneficiaries |
| reimbursementToRecipient | PolicySetting (default: DISALLOWED) | Policy for reimbursements to beneficiaries |
| rentUtilityPayments | PolicySetting (default: REQUIRES_REVIEW) | Policy for rent/utility payments |
| recurringSubscriptions | PolicySetting (default: ALLOWED) | Policy for recurring subscription payments |
| maxSingleTransaction | Decimal(10,2)? | Maximum amount for a single transaction |
| autoApproveEnabled | Boolean (default: false) | Whether auto-approval is enabled |
| autoApproveMaxAmount | Decimal(12,2)? | Maximum amount eligible for auto-approval |
| autoApproveCategories | Json? | Array of category IDs eligible for auto-approval |
| autoApproveRiskLevels | Json? | Risk levels eligible for auto-approval, e.g. ["LIKELY_SAFE"] |
| requireReviewAbove | Decimal(12,2)? | Amount threshold above which manual review is required |
| allowedCategories | Json? | Array of allowed expense category names |
| blockedCategories | Json? | Array of blocked expense category names |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId)

**Indexes:**
- `@@index([organizationId])`

---

### PromoCode
**Purpose:** Promotional codes that grant free trial days to organizations. Created by platform admins.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| code | String @unique | The promo code string |
| description | String? | Description of the promo |
| trialDays | Int | Number of free trial days this code grants |
| maxUses | Int (default: 50) | Maximum redemptions allowed |
| currentUses | Int (default: 0) | Current number of redemptions |
| isActive | Boolean (default: true) | Whether the code is currently active |
| expiresAt | DateTime? | When the code itself expires |
| createdById | String | Platform admin user ID who created it |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Has many `PromoRedemption[]`

**Indexes:**
- `@@index([code])`
- `@@index([isActive])`

---

### PromoRedemption
**Purpose:** Records when an organization redeems a promo code. Each org can only redeem a given code once.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| promoCodeId | String | FK to PromoCode |
| organizationId | String | FK to Organization |
| redeemedById | String | User ID who redeemed the code |
| redeemedAt | DateTime (default: now()) | When the code was redeemed |

**Relations:**
- Belongs to `PromoCode` (via promoCodeId)
- Belongs to `Organization` (via organizationId)

**Unique constraints:**
- `@@unique([promoCodeId, organizationId])` -- One code per org

**Indexes:**
- `@@index([organizationId])`

---

### CalendarEvent
**Purpose:** Organization calendar events for tracking grant deadlines, payment dates, compliance milestones, and subscription renewals.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| title | String | Event title |
| description | String? | Event description |
| startDate | DateTime | Event start date/time |
| endDate | DateTime? | Event end date/time |
| category | String (default: "general") | Category: "grants", "payments", "compliance", "subscriptions", "general" |
| color | String? | Hex color for calendar display |
| createdById | String | User ID who created the event |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId)

**Indexes:**
- `@@index([organizationId])`
- `@@index([startDate])`

---

### OrganizationMembership
**Purpose:** Multi-tenant membership linking users to organizations. Supports users belonging to multiple organizations with different roles and statuses.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| userId | String | FK to User |
| organizationId | String | FK to Organization |
| role | String (default: "member") | Role within this org (matches UserRole values) |
| memberCode | String? @unique | Human-readable member ID, e.g. "TM-0001-00001" |
| status | String (default: "active") | Membership status: active, suspended, pending, revoked |
| invitedBy | String? | User ID who invited this member |
| joinedAt | DateTime (default: now()) | When the user joined this org |
| isDefaultOrg | Boolean (default: false) | Whether this is the user's default org |
| lastAccessedAt | DateTime? | Last time user accessed this org |
| orgSpecificTitle | String? | Custom title within this org |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `User` (via userId, onDelete: Cascade)
- Belongs to `Organization` (via organizationId, onDelete: Cascade)

**Unique constraints:**
- `@@unique([userId, organizationId])`

**Indexes:**
- `@@index([userId])`
- `@@index([organizationId])`
- `@@index([userId, status])`

---

### Integration
**Purpose:** Tracks third-party service connections (via Composio) for workflow automation. Each org can connect one instance of each provider.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| provider | String | Provider name: "gmail", "slack", "google_calendar", "google_sheets", "asana", "trello" |
| composioConnectionId | String? | Composio's connection ID for this org+provider |
| status | String (default: "disconnected") | Connection status: "connected", "disconnected", "error" |
| connectedBy | String? | User ID who connected the integration |
| connectedAt | DateTime? | When the integration was connected |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId, onDelete: Cascade)

**Unique constraints:**
- `@@unique([organizationId, provider])`

**Indexes:**
- `@@index([organizationId])`

---

### WorkflowTrigger
**Purpose:** Defines automated actions that fire when specific events occur (e.g., send email when expense is approved). Uses Composio action slugs.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| eventType | String | Trigger event: "expense_approved", "card_issued", "transaction_needs_review", "grant_low_balance", "beneficiary_onboarded" |
| provider | String | Which integration this trigger uses |
| actionSlug | String | Composio tool slug, e.g. "GMAIL_SEND_EMAIL" |
| actionConfig | Json | Template data: subject, body template, channel, etc. |
| enabled | Boolean (default: true) | Whether this trigger is active |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId, onDelete: Cascade)

**Indexes:**
- `@@index([organizationId, eventType])`
- `@@index([organizationId, enabled])`

---

### WorkflowLog
**Purpose:** Execution log for workflow triggers. Records success/failure of each automated action for debugging and audit.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| triggerId | String | ID of the WorkflowTrigger that fired |
| eventType | String | Event that triggered the workflow |
| provider | String | Provider that executed the action |
| actionSlug | String | Composio action slug that was executed |
| status | String | Execution result: "success", "failed", "skipped" |
| requestPayload | Json? | Payload sent to the provider |
| responsePayload | Json? | Response received from the provider |
| errorMessage | String? | Error message if execution failed |
| executionTimeMs | Int? | Execution duration in milliseconds |
| createdAt | DateTime (default: now()) | Record creation timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId, onDelete: Cascade)

**Indexes:**
- `@@index([organizationId, createdAt])`
- `@@index([triggerId])`

---

### GrantReport
**Purpose:** Generated compliance/disbursement reports for grants, created by the SentinelLayer Reporter module.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | Organization scope |
| grantId | String | Grant this report covers |
| reportType | String (default: "weekly_disbursement") | Report type identifier |
| reportData | Json | Full report data payload |
| periodStart | DateTime | Reporting period start |
| periodEnd | DateTime | Reporting period end |
| generatedAt | DateTime (default: now()) | When the report was generated |
| generatedBy | String (default: "sentinellayer_reporter") | Who/what generated the report |
| status | String (default: "draft") | Report status: "draft", "reviewed", "final" |

**Indexes:**
- `@@index([organizationId, grantId])`
- `@@index([organizationId, generatedAt])`

---

### BillingSubscription
**Purpose:** BenefitsSafe platform billing record for an organization. Tracks Stripe subscription for the platform itself (not vendor subscriptions).

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String @unique | FK to Organization (one-to-one) |
| tier | String (default: "free") | Pricing tier: "free", "starter", "growth", "professional", "enterprise" |
| stripeCustomerId | String? | Stripe Customer ID |
| stripeSubscriptionId | String? | Stripe Subscription ID |
| stripePriceId | String? | Stripe Price ID |
| currentPeriodStart | DateTime? | Current billing period start |
| currentPeriodEnd | DateTime? | Current billing period end |
| cancelAtPeriodEnd | Boolean (default: false) | Whether subscription cancels at period end |
| status | String (default: "trialing") | Subscription status: "trialing", "active", "past_due", "canceled", "unpaid" |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId, one-to-one)

**Indexes:**
- `@@index([organizationId])`
- `@@index([stripeCustomerId])`
- `@@index([stripeSubscriptionId])`

---

### UsageCounter
**Purpose:** Monthly usage metrics per organization for metered billing and tier enforcement.

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| organizationId | String | FK to Organization |
| period | String | Year-month string, e.g. "2026-04" |
| beneficiariesAdded | Int (default: 0) | Beneficiaries added this period |
| grantsCreated | Int (default: 0) | Grants created this period |
| expensesProcessed | Int (default: 0) | Expenses processed this period |
| cardsIssued | Int (default: 0) | Cards issued this period |
| apiCalls | Int (default: 0) | API calls made this period |
| storageMB | Float (default: 0) | Storage used in MB this period |
| createdAt | DateTime (default: now()) | Record creation timestamp |
| updatedAt | DateTime @updatedAt | Last update timestamp |

**Relations:**
- Belongs to `Organization` (via organizationId)

**Unique constraints:**
- `@@unique([organizationId, period])`

**Indexes:**
- `@@index([organizationId])`

---

## Enums

### UserRole
| Value | Description |
|-------|-------------|
| nonprofit_admin | Organization owner with full access to all features |
| nonprofit_staff | Staff member with limited write access |
| beneficiary | Benefit recipient; can only see their own data |
| vendor | External vendor; manages their own profile and invoices |
| cpa | Certified Public Accountant; read access to reports and audit trail |
| auditor | External auditor; read-only access to financial records |
| attorney | Legal advisor; compliance and policy review access |
| grant_officer | Grant issuer representative; grant-level oversight |
| platform_admin | BenefitsSafe internal staff; full platform access (god mode) |
| support_agent | BenefitsSafe support staff; limited platform access |
| compliance_officer | Compliance specialist; policy and risk review access |
| billing_admin | Billing administrator; manages platform subscriptions and invoicing |

### GrantStatus
| Value | Description |
|-------|-------------|
| DRAFT | Grant created but not yet activated |
| ACTIVE | Grant is live and funds can be disbursed |
| PAUSED | Grant temporarily suspended (no new expenses) |
| COMPLETED | All funds disbursed or grant period ended |
| ARCHIVED | Soft-deleted / no longer visible in default views |

### CardMode
| Value | Description |
|-------|-------------|
| SINGLE_CARD | One virtual card shared across all vendors in this category |
| PER_VENDOR | A separate virtual card issued per vendor in this category |

### ExpenseFrequency
| Value | Description |
|-------|-------------|
| ONE_TIME | Single payment |
| MONTHLY | Recurring monthly payment |
| QUARTERLY | Recurring quarterly payment |
| ANNUAL | Recurring annual payment |

### RiskLevel
| Value | Description |
|-------|-------------|
| PENDING | Not yet classified by the compliance engine |
| LIKELY_SAFE | Low risk; proceeds to normal approval workflow |
| NEEDS_REVIEW | Medium risk; flagged for manual compliance review |
| LIKELY_RISKY | High risk; requires attorney or compliance officer review |
| BLOCKED | Automatically blocked; violates federal benefit rules |

### ExpenseStatus
| Value | Description |
|-------|-------------|
| PENDING | Submitted, awaiting approval |
| APPROVED | Approved by authorized reviewer |
| REJECTED | Rejected by reviewer |
| PAID | Payment has been disbursed |
| CANCELLED | Cancelled by requester or admin |

### VendorType
| Value | Description |
|-------|-------------|
| SAAS_SUBSCRIPTION | Software-as-a-Service provider (e.g., Adobe, Zoom) |
| SERVICE_PROVIDER | Professional services vendor (e.g., editor, tutor) |
| ONE_TIME_VENDOR | One-off purchase vendor |

### VendorStatus
| Value | Description |
|-------|-------------|
| DRAFT | Vendor record created but not submitted for approval |
| PENDING | Submitted for admin review |
| APPROVED | Approved by admin |
| AWAITING_PAYMENT_SETUP | Approved but payment method not yet configured |
| ACTIVE | Fully set up and ready to receive payments |
| BLOCKED | Blocked from receiving payments |
| ARCHIVED | Soft-deleted |

### BillingUpdateStatus
| Value | Description |
|-------|-------------|
| PENDING | Card not yet issued for this subscription |
| CARD_ISSUED | Virtual card has been created |
| CARD_SHARED | Card details shared with vendor |
| UPDATED | Vendor has updated their billing to use the new card |
| VERIFIED | Billing update verified (charge confirmed) |

### SubscriptionStatus
| Value | Description |
|-------|-------------|
| ACTIVE | Subscription is active and being paid |
| PAUSED | Subscription temporarily paused |
| CANCELLED | Subscription cancelled |
| EXPIRED | Subscription expired without renewal |

### CardStatus
| Value | Description |
|-------|-------------|
| ACTIVE | Card is active and can be used for transactions |
| FROZEN | Card temporarily frozen (no transactions allowed) |
| CANCELLED | Card permanently cancelled |
| EXPIRED | Card has passed its expiration date |

### EligibilityStatus
| Value | Description |
|-------|-------------|
| ELIGIBLE | Beneficiary is fully eligible for card issuance |
| RESTRICTED_CALFRESH_ONLY | Limited eligibility; CalFresh benefits only |
| INELIGIBLE_WARRANT | Ineligible due to active warrant |
| INELIGIBLE_INCARCERATED | Ineligible due to current incarceration |
| PENDING_VERIFICATION | Eligibility not yet verified |

### PolicySetting
| Value | Description |
|-------|-------------|
| ALLOWED | This disbursement type is allowed without restriction |
| DISALLOWED | This disbursement type is blocked |
| REQUIRES_REVIEW | This disbursement type requires manual review before approval |

### LedgerType
| Value | Description |
|-------|-------------|
| CREDIT | Funds added (grant deposit, refund, adjustment) |
| DEBIT | Funds removed (expense payment, card charge) |

### ApprovalAction
| Value | Description |
|-------|-------------|
| APPROVED | Expense approved |
| REJECTED | Expense rejected |
| REQUESTED_INFO | More information requested from submitter |

---

## Entity Relationship Summary

### Core hierarchy
- **Organization** 1:N Users, Grants, Vendors, VirtualCards, DisbursementPolicies, CardholderEligibilities, CalendarEvents, OrganizationMemberships, Integrations, WorkflowTriggers, WorkflowLogs, PromoRedemptions, UsageCounters
- **Organization** 1:1 BillingSubscription

### User relationships
- **User** N:1 Organization (via organizationId)
- **User** 1:N ExpenseRequests (as requestedBy)
- **User** 1:N Approvals (as approver)
- **User** 1:N Grants (as beneficiary, named "GrantBeneficiary")
- **User** 1:N Vendors (as vendor user account)
- **User** 1:N InviteTokens
- **User** 1:1 CardholderEligibility (optional)
- **User** 1:N OrganizationMemberships
- **User** 1:N VirtualCards (as beneficiary, named "CardBeneficiary")

### Grant relationships
- **Grant** N:1 Organization
- **Grant** N:1 User (optional beneficiary)
- **Grant** 1:N BudgetCategories
- **Grant** 1:N ExpenseRequests

### Budget and expense flow
- **BudgetCategory** N:1 Grant
- **BudgetCategory** 1:N ExpenseRequests
- **BudgetCategory** 1:N VirtualCards
- **ExpenseRequest** N:1 Grant
- **ExpenseRequest** N:1 BudgetCategory
- **ExpenseRequest** N:1 User (requestedBy)
- **ExpenseRequest** N:1 Vendor (optional)
- **ExpenseRequest** 1:N Approvals
- **ExpenseRequest** 1:N LedgerEntries
- **ExpenseRequest** 1:N VirtualCards

### Vendor relationships
- **Vendor** N:1 Organization
- **Vendor** N:1 User (optional user account)
- **Vendor** 1:N ExpenseRequests
- **Vendor** 1:N Subscriptions
- **Vendor** 1:N VirtualCards

### Card and transaction flow
- **VirtualCard** N:1 Organization
- **VirtualCard** N:1 BudgetCategory (optional)
- **VirtualCard** N:1 ExpenseRequest (optional)
- **VirtualCard** N:1 Vendor (optional)
- **VirtualCard** N:1 User (optional beneficiary)
- **VirtualCard** 1:N Subscriptions
- **VirtualCard** 1:N Transactions
- **Transaction** N:1 VirtualCard

### Subscription flow
- **Subscription** N:1 Vendor
- **Subscription** N:1 VirtualCard (optional card)

### Immutable records
- **LedgerEntry** N:1 ExpenseRequest (optional) -- NEVER updated or deleted
- **AuditLog** -- standalone, NEVER updated or deleted

### Messaging
- **Conversation** 1:N ConversationParticipants
- **Conversation** 1:N Messages
- **ConversationParticipant** N:1 Conversation

### Promo codes
- **PromoCode** 1:N PromoRedemptions
- **PromoRedemption** N:1 PromoCode
- **PromoRedemption** N:1 Organization

### Workflow automation
- **Integration** N:1 Organization (unique on [organizationId, provider])
- **WorkflowTrigger** N:1 Organization
- **WorkflowLog** N:1 Organization

### Billing
- **BillingSubscription** 1:1 Organization
- **UsageCounter** N:1 Organization (unique on [organizationId, period])
