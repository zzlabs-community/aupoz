import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Use WebSocket transport for Neon in Node.js
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaNeon({ connectionString });

// Verbose logs in development for easier debugging
const logLevels: Prisma.LogLevel[] =
  process.env.NODE_ENV === "development"
    ? ["query", "info", "warn", "error"]
    : ["warn", "error"];

let client: PrismaClient | undefined = globalForPrisma.prisma;
if (!client) {
  try {
    client = new PrismaClient({ adapter, log: logLevels });
  } catch (e) {
    // As a fallback, instantiate with default to surface better errors
    client = new PrismaClient({ log: logLevels } as any);
  }
}
export const prisma = client!;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
