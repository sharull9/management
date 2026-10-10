import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
export function writeAudit(
  data: Prisma.AuditLogUncheckedCreateInput,
  tx: Prisma.TransactionClient = db,
) {
  return tx.auditLog.create({ data });
}
