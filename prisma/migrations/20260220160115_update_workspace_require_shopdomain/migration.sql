-- Backfill null shopDomain values with unique placeholders
UPDATE "Workspace"
SET "shopDomain" = 'workspace-' || "id" || '.invalid'
WHERE "shopDomain" IS NULL;

-- Make installedAt nullable and drop default
ALTER TABLE "Workspace"
  ALTER COLUMN "installedAt" DROP NOT NULL,
  ALTER COLUMN "installedAt" DROP DEFAULT;

-- Enforce NOT NULL on shopDomain
ALTER TABLE "Workspace"
  ALTER COLUMN "shopDomain" SET NOT NULL;
