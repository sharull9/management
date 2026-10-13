import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalDb = globalThis as unknown as { prisma?: PrismaClient };
// Optional pool cap; local `prisma dev` drops connections under concurrent queries.
const poolMax = Number(process.env.DATABASE_POOL_MAX) || undefined;
export const db = globalDb.prisma?.stockMovement
  ? globalDb.prisma
  : new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: poolMax,
      }),
    });
if (process.env.NODE_ENV !== "production") {
  if (globalDb.prisma && globalDb.prisma !== db)
    void globalDb.prisma.$disconnect();
  globalDb.prisma = db;
}
