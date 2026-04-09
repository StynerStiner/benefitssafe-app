# BenefitsSafe Cascade Behavior

## Prisma Cascade Rules

BenefitsSafe uses **soft deletes** (`archivedAt` field) for all financial records.
Hard deletes are only allowed for non-financial data via Prisma's `onDelete` cascade.

### Organization Deletion Cascade

When an Organization is deleted (should NEVER happen in production):

| Model | Cascade Rule | Behavior |
|---|---|---|
| User | `onDelete: Cascade` | All users deleted |
| Grant | `onDelete: Cascade` | All grants deleted |
| Vendor | `onDelete: Cascade` | All vendors deleted |
| VirtualCard | `onDelete: Cascade` | All cards deleted |
| DisbursementPolicy | `onDelete: Cascade` | All policies deleted |
| PromoRedemption | `onDelete: Cascade` | All redemptions deleted |
| CardholderEligibility | `onDelete: Cascade` | All eligibility records deleted |
| CalendarEvent | `onDelete: Cascade` | All events deleted |
| OrganizationMembership | `onDelete: Cascade` | All memberships deleted |
| Integration | `onDelete: Cascade` | All integrations deleted |
| WorkflowTrigger | `onDelete: Cascade` | All triggers deleted |
| WorkflowLog | `onDelete: Cascade` | All logs deleted |
| BillingSubscription | `onDelete: Cascade` | Billing record deleted |
| UsageCounter | `onDelete: Cascade` | All counters deleted |
| BudgetCategory | `onDelete: Cascade` | All categories deleted |
| Subscription | `onDelete: Cascade` | All subscriptions deleted |
| Approval | `onDelete: Cascade` | All approvals deleted |

### User Deletion Cascade

When a User is deleted:

| Model | Cascade Rule | Notes |
|---|---|---|
| OrganizationMembership | `onDelete: Cascade` | Memberships removed |
| ExpenseRequest (requestedBy) | Relation exists | Check if cascades or restricts |
| Approval (approver) | Relation exists | Check if cascades or restricts |
| Notification | Relation exists | User's notifications |

### Grant Deletion

Grants should **never** be hard-deleted. Use `archivedAt` soft delete instead.

If a Grant were deleted:
- ExpenseRequest records reference `grantId` (would fail FK)
- BudgetCategory records reference `grantId` (would fail FK)
- LedgerEntry records reference `grantId` (would fail FK — IMMUTABLE)
- VirtualCard records reference `grantId` (would fail FK)

**Conclusion**: Grant deletion is blocked by FK constraints on immutable records.
This is correct behavior — financial records must never be orphaned.

### Safe Operations

| Operation | Allowed | Method |
|---|---|---|
| Archive a grant | YES | Set `archivedAt = now()`, `status = ARCHIVED` |
| Archive a vendor | YES | Set `archivedAt = now()` |
| Deactivate a user | YES | Set `isActive = false` |
| Cancel a card | YES | Set `status = CANCELLED` |
| Delete an organization | NO | Too many cascading implications |
| Delete a grant | NO | FK constraints prevent it |
| Delete a ledger entry | NO | IMMUTABLE — never delete |
| Delete an audit log | NO | IMMUTABLE — never delete |

### Data Retention

- **AuditLog**: Retain indefinitely (compliance requirement)
- **LedgerEntry**: Retain indefinitely (financial compliance)
- **Transaction**: Retain 7 years minimum (IRS requirement)
- **Archived records**: Retain indefinitely, exclude from active queries via `archivedAt IS NULL`
