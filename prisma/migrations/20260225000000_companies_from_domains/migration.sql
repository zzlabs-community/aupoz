-- Migration: Companies from Domains (replaces Workspace)
-- Max 5 companies per user, AI domain scanning

-- Create enum types
CREATE TYPE "Platform" AS ENUM ('instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'youtube', 'pinterest');
CREATE TYPE "ContentStatus" AS ENUM ('idea', 'draft', 'scheduled', 'published', 'archived');
CREATE TYPE "CampaignType" AS ENUM ('carousel', 'single_post', 'story', 'reel', 'video');
CREATE TYPE "TriggerType" AS ENUM ('new_product', 'schedule', 'manual', 'low_stock', 'price_change');

-- Create Company table (replaces Workspace)
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT cuid(),
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "products" TEXT,
    "targetAudience" TEXT,
    "brandColors" TEXT[] NOT NULL DEFAULT '{}',
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "isScanned" BOOLEAN NOT NULL DEFAULT false,
    "scannedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Company_userId_domain_key" ON "Company"("userId", "domain");
CREATE INDEX "Company_userId_idx" ON "Company"("userId");

-- Create BrandProfile table (linked to Company)
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT cuid(),
    "companyId" TEXT NOT NULL UNIQUE,
    "brandVoice" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "positioning" TEXT NOT NULL,
    "keyMessages" TEXT[] NOT NULL DEFAULT '{}',
    "colorPalette" TEXT[] NOT NULL DEFAULT '{}',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "BrandProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create Campaign table (linked to Company)
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT cuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "campaignType" "CampaignType" NOT NULL DEFAULT 'single_post',
    "content" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "Campaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Campaign_companyId_idx" ON "Campaign"("companyId");

-- Create AutomationRule table (linked to Company)
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT cuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "TriggerType" NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "actionConfig" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,
    "lastExecutedAt" TIMESTAMP(3),
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    CONSTRAINT "AutomationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AutomationRule_companyId_isActive_idx" ON "AutomationRule"("companyId", "isActive");

-- Create Post table (linked to Company instead of Workspace)
ALTER TABLE "Post" RENAME COLUMN "workspaceId" TO "companyId";
ALTER TABLE "Post" ADD CONSTRAINT "Post_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new columns to Post
ALTER TABLE "Post" ADD COLUMN "imagePrompt" TEXT;
ALTER TABLE "Post" ADD COLUMN "hashtags" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Post" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'draft';
ALTER TABLE "Post" ADD COLUMN "platform" "Platform" NOT NULL DEFAULT 'instagram';

-- Update indexes
DROP INDEX IF EXISTS "Post_workspaceId_scheduledAt_idx";
DROP INDEX IF EXISTS "Post_workspaceId_status_idx";
CREATE INDEX "Post_companyId_scheduledAt_idx" ON "Post"("companyId", "scheduledAt");
CREATE INDEX "Post_companyId_status_idx" ON "Post"("companyId", "status");

-- Drop old Workspace related tables (if not referenced)
-- Note: keeping Workspace for backward compatibility, but no new data should be added

-- Add user relation to Company
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companies" INTEGER NOT NULL DEFAULT 0;
