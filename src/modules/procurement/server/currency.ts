import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { organizationBaseCurrency } from "@/modules/currency/server/rates";

/** Documents may only use the base currency or a currency enabled for the tenant. */
export async function assertDocumentCurrency(
  tx: Prisma.TransactionClient,
  tenantId: string,
  organizationId: string,
  currency: string,
) {
  const base = await organizationBaseCurrency(tx, organizationId);
  if (currency === base.code) return base;
  const enabled = await tx.tenantCurrency.findFirst({
    where: { tenantId, currencyCode: currency, enabled: true },
    select: { id: true },
  });
  if (!enabled)
    throw new Error(`${currency} is not enabled for this organization.`);
  return base;
}
