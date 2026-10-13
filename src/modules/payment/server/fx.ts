import "server-only";
import type { OrgContext } from "@/core/context";
import type { Numeric } from "@/core/decimal";
import type { Prisma } from "@/generated/prisma/client";
import { resolveDocumentFx } from "@/modules/currency/server/rates";

type Tx = Prisma.TransactionClient;

/** Only tenant-enabled currencies (and the base currency) may be chosen on documents. */
export async function assertCurrencyEnabled(
  tx: Tx,
  ctx: OrgContext,
  currency: string,
) {
  if (currency === ctx.org.baseCurrency) return;
  const row = await tx.tenantCurrency.findFirst({
    where: {
      tenantId: ctx.tenant.id,
      currencyCode: currency,
      enabled: true,
      currency: { active: true },
    },
    select: { currencyCode: true },
  });
  if (!row) throw new Error(`${currency} is not enabled for this tenant.`);
}

/** Validates the currency and resolves the document rate plus base conversion. */
export async function documentFx(
  tx: Tx,
  ctx: OrgContext,
  input: { currency: string; date: Date; override?: Numeric | null },
) {
  await assertCurrencyEnabled(tx, ctx, input.currency);
  return resolveDocumentFx(tx, {
    organizationId: ctx.org.id,
    currency: input.currency,
    date: input.date,
    override: input.override,
  });
}
