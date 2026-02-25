-- AUPOZ Production-Ready Migration
-- Multi-tenant, Brand Profile, Campaigns, Automations

-- Create enums
CREATE TYPE "Platform" AS ENUM ('instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'youtube', 'pinterest');
CREATE TYPE "ContentStatus" AS ENUM ('idea', 'draft', 'scheduled', 'published', 'archived');
CREATE TYPE "CampaignType" AS ENUM ('carousel', 'single_post', 'story', 'reel', 'video');
CREATE TYPE "TriggerType" AS ENUM ('new_product', 'schedule', 'manual', 'low_stock', 'price_change');

-- Brand Profile table
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "workspaceId" TEXT NOT NULL UNIQUE,
    "brandVoice" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "positioning" TEXT NOT NULL,
    "keyMessages" TEXT[] NOT NULL DEFAULT '{}',
    "colorPalette" TEXT[] NOT NULL DEFAULT '{}',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "productsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "BrandProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Campaign table
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "campaignType" "CampaignType" NOT NULL DEFAULT 'single_post',
    "content" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Campaign_workspaceId_idx" ON "Campaign"("workspaceId");

-- Automation Rule table
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "TriggerType" NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "actionConfig" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "workspaceId" TEXT NOT NULL,
    "lastExecutedAt" TIMESTAMP(3),
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "AutomationRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AutomationRule_workspaceId_isActive_idx" ON "AutomationRule"("workspaceId", "isActive");

-- Add new columns to Product table (only if they don't exist)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "vendor" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productType" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';

-- Add new columns to Post table (only if they don't exist)
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "imagePrompt" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "hashtags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "status" "ContentStatus" NOT NULL DEFAULT 'draft';
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

-- Convert platform to enum if it exists as text
ALTER TABLE "Post" ALTER COLUMN "platform" TYPE "Platform" USING "platform"::"Platform";

-- Add FK for campaignId (will fail if already exists, which is ok)
ALTER TABLE "Post" ADD CONSTRAINT "Post_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS "Post_workspaceId_scheduledAt_idx" ON "Post"("workspaceId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "Post_workspaceId_status_idx" ON "Post"("workspaceId", "status");
