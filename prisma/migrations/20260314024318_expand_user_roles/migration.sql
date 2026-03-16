-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'nonprofit_staff';
ALTER TYPE "UserRole" ADD VALUE 'auditor';
ALTER TYPE "UserRole" ADD VALUE 'attorney';
ALTER TYPE "UserRole" ADD VALUE 'grant_officer';
ALTER TYPE "UserRole" ADD VALUE 'support_agent';
ALTER TYPE "UserRole" ADD VALUE 'compliance_officer';
ALTER TYPE "UserRole" ADD VALUE 'billing_admin';
