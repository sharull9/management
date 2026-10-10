import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
export async function nextDocumentNumber(
  orgId: string,
  type: string,
  tx?: Prisma.TransactionClient,
): Promise<string> {
  const allocate = async (client: Prisma.TransactionClient) => {
    await client.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`series:${orgId}:${type}`}))::text`;
    const series = await client.documentSeries.upsert({
      where: { organizationId_type: { organizationId: orgId, type } },
      create: {
        organizationId: orgId,
        type,
        prefix: `${type}-`,
        nextNumber: 2,
      },
      update: { nextNumber: { increment: 1 } },
    });
    return `${series.prefix}${String(series.nextNumber - 1).padStart(series.padding, "0")}`;
  };
  return tx ? allocate(tx) : db.$transaction(allocate);
}
