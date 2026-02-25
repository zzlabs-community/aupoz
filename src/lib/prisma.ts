import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Use WebSocket transport for Neon in Node.js
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization to avoid build-time errors when DATABASE_URL is not set
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;
  
  // Verbose logs in development for easier debugging
  const logLevels: Prisma.LogLevel[] =
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["warn", "error"];

  // Only create adapter if connection string is available
  if (connectionString) {
    const adapter = new PrismaNeon({ connectionString });
    return new PrismaClient({ adapter, log: logLevels });
  }
  
  // Fallback: instantiate with default (will fail at runtime if no DB)
  return new PrismaClient({ log: logLevels } as any);
}

let client: PrismaClient | undefined = globalForPrisma.prisma;
if (!client) {
  client = createPrismaClient();
}

// Export a proxy that defers error until actually used
export const prisma: PrismaClient = client!;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
