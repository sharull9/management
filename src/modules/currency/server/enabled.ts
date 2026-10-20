import { UserFacingError } from "@/core/errors";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Documents, projects and party defaults may only use a currency that is enabled
 * (and active) for the tenant. Pass the organization's `baseCurrency` to accept
 * it without a lookup; the base currency is always enabled for its tenant.
 */
export async function assertEnabledCurrency(
  tx: Prisma.TransactionClient,
  tenantId: string,
  code: string,
  baseCurrency?: string,
) {
  if (baseCurrency !== undefined && code === baseCurrency) return;
  const row = await tx.tenantCurrency.findFirst({
    where: {
      tenantId,
      currencyCode: code,
      enabled: true,
      currency: { active: true },
    },
    select: { currencyCode: true },
  });
  if (!row)
    throw new UserFacingError(
      `${code} is not an enabled currency for this tenant.`,
    );
}
