-- Step 1: Add new columns with defaults so existing rows survive
ALTER TABLE "User" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Step 2: Populate from existing "name" field (split on first space)
UPDATE "User"
SET
  "firstName" = CASE
    WHEN POSITION(' ' IN "name") > 0 THEN LEFT("name", POSITION(' ' IN "name") - 1)
    ELSE "name"
  END,
  "lastName" = CASE
    WHEN POSITION(' ' IN "name") > 0 THEN SUBSTRING("name" FROM POSITION(' ' IN "name") + 1)
    ELSE ''
  END;

-- Step 3: Remove default constraints now that data is populated
ALTER TABLE "User" ALTER COLUMN "firstName" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "lastName" DROP DEFAULT;

-- Step 4: Drop the old name column
ALTER TABLE "User" DROP COLUMN "name";
