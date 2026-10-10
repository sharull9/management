import "server-only";
import { db } from "@/core/db";
import type { Prisma } from "@/generated/prisma/client";
export function projectSpent(
  projectId: string,
  tx: Prisma.TransactionClient = db,
) {
  return tx.costEntry
    .aggregate({ where: { projectId }, _sum: { amount: true } })
    .then((r) => r._sum.amount?.toFixed(2) ?? "0.00");
}
