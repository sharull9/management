import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export async function lockAccountingTenant(tx: Tx, tenantId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`accounting-tenant:${tenantId}`}))::text`;
}

export async function lockAccountingScope(tx: Tx, organizationId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`accounting:${organizationId}`}))::text`;
}
