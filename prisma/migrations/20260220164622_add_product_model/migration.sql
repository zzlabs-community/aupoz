-- CreateTable Product
CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "shopifyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "handle" TEXT,
  "imageUrl" TEXT,
  "workspaceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- Foreign Key
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique composite index
CREATE UNIQUE INDEX "Product_workspaceId_shopifyId_key" ON "Product"("workspaceId", "shopifyId");

-- Trigger to emulate @updatedAt (PostgreSQL)
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_timestamp ON "Product";
CREATE TRIGGER set_timestamp BEFORE UPDATE ON "Product" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
