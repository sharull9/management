import "server-only";
import type { OrgContext } from "@/core/context";
import type { Numeric } from "@/core/decimal";
import type { Prisma } from "@/generated/prisma/client";
import { assertEnabledCurrency } from "@/modules/currency/server/enabled";
import { resolveDocumentFx } from "@/modules/currency/server/rates";

type Tx = Prisma.TransactionClient;

/** Validates the currency and resolves the document rate plus base conversion. */
export async function documentFx(
  tx: Tx,
  ctx: OrgContext,
  input: { currency: string; date: Date; override?: Numeric | null },
) {
  await assertEnabledCurrency(
    tx,
    ctx.tenant.id,
    input.currency,
    ctx.org.baseCurrency,
  );
  return resolveDocumentFx(tx, {
    organizationId: ctx.org.id,
    currency: input.currency,
    date: input.date,
    override: input.override,
  });
}
