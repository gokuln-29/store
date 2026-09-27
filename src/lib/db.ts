import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const int = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * Connection pool per server instance. On a VPS the default of 10 is fine; on serverless hosts
 * (Vercel) point DATABASE_URL at a pooler (PgBouncer, Supabase/Neon pooled URL) and set
 * DATABASE_POOL_MAX to 1–3. See docs/security-checklist.md.
 */
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: int(process.env.DATABASE_POOL_MAX, 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // A runaway query is cancelled instead of holding a connection forever.
      statement_timeout: int(process.env.DATABASE_STATEMENT_TIMEOUT_MS, 15_000),
    }),
  });
}

// Reuse a single client across hot reloads in development to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
