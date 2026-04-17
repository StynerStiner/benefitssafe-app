-- Migration: add_missing_indexes
-- Generated: 2026-04-17
-- Scope: 14 composite indexes + 1 unique index on existing
--        columns. Pure additive DDL. Zero data risk.
--
-- IN SCOPE:
--   14 CREATE INDEX for @@index declarations in schema.prisma
--      that were not created by prior migrations
--   1 CREATE UNIQUE INDEX for VirtualCard.stripeCardId @unique
--      (correctness -- prevents duplicate Stripe card IDs)
--
-- OUT OF SCOPE:
--   11 reverse-drift indexes (indexes in Aurora not declared
--      in schema). Leaving in place -- dropping requires
--      per-index query-plan analysis first.
--
-- Safety: All target tables have columns that exist (Migrations
--         1 and 2 landed). VirtualCard is empty (0 rows, 0
--         duplicate stripeCardIds) so unique index is safe.

-- ============================================================
-- AuditLog (2)
-- ============================================================
CREATE INDEX "AuditLog_userId_organizationId_idx" ON "AuditLog"("userId", "organizationId");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- ============================================================
-- ExpenseRequest (2)
-- ============================================================
CREATE INDEX "ExpenseRequest_requestedById_status_idx" ON "ExpenseRequest"("requestedById", "status");
CREATE INDEX "ExpenseRequest_grantId_status_createdAt_idx" ON "ExpenseRequest"("grantId", "status", "createdAt");

-- ============================================================
-- Grant (2)
-- ============================================================
CREATE INDEX "Grant_organizationId_status_idx" ON "Grant"("organizationId", "status");
CREATE INDEX "Grant_organizationId_createdAt_idx" ON "Grant"("organizationId", "createdAt");

-- ============================================================
-- LedgerEntry (1)
-- ============================================================
CREATE INDEX "LedgerEntry_grantId_createdAt_idx" ON "LedgerEntry"("grantId", "createdAt");

-- ============================================================
-- Subscription (2)
-- ============================================================
CREATE INDEX "Subscription_grantId_status_idx" ON "Subscription"("grantId", "status");
CREATE INDEX "Subscription_vendorId_status_idx" ON "Subscription"("vendorId", "status");

-- ============================================================
-- Transaction (1)
-- ============================================================
CREATE INDEX "Transaction_cardId_createdAt_idx" ON "Transaction"("cardId", "createdAt");

-- ============================================================
-- Vendor (2)
-- ============================================================
CREATE INDEX "Vendor_organizationId_status_idx" ON "Vendor"("organizationId", "status");
CREATE INDEX "Vendor_organizationId_createdAt_idx" ON "Vendor"("organizationId", "createdAt");

-- ============================================================
-- VirtualCard (3)
--   stripeCardId_key is the correctness fix -- without it,
--   duplicate Stripe card IDs could insert.
-- ============================================================
CREATE UNIQUE INDEX "VirtualCard_stripeCardId_key" ON "VirtualCard"("stripeCardId");
CREATE INDEX "VirtualCard_organizationId_status_idx" ON "VirtualCard"("organizationId", "status");
CREATE INDEX "VirtualCard_organizationId_createdAt_idx" ON "VirtualCard"("organizationId", "createdAt");
