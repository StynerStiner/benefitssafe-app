-- Additive migration: add Terms of Service and Privacy Policy acceptance
-- tracking to the User table. All columns are nullable so existing rows
-- are unaffected; new signups populate them in the /api/auth/register
-- route with termsVersion / privacyVersion = "1.0" and the acceptance
-- timestamp in UTC.

ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "privacyVersion" TEXT;
