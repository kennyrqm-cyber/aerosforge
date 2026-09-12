import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { db: PrismaClient | undefined };

function createClient() {
  const buildPhase = process.env.NEXT_PHASE === "phase-production-build";
  const connectionString = process.env.DATABASE_URL
    ?? (buildPhase ? "postgresql://build:build@127.0.0.1:5432/aerosforge_build" : undefined);
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForPrisma.db ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.db = db;
