-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_shopDomain_key" ON "Workspace"("shopDomain");
