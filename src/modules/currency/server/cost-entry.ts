import { Decimal, type Numeric } from "@/core/decimal";
import type { Prisma } from "@/generated/prisma/client";
import { costAmounts } from "../util";
import { organizationBaseCurrency, resolveRate } from "./rates";

export type CostEntryAmountsInput = {
  organizationId: string;
  projectId: string;
  date: Date | string;
  /** Currency of `amount`; defaults to the organization base currency. */
  currency?: string;
  amount: Numeric;
  /** Base units per 1 `currency` unit; resolved from dated rates when omitted. */
  exchangeRate?: Numeric;
};

/**
 * The CostEntry money fields for one posting. Spread the result into the
 * `data` of every `costEntry` create/upsert; `amount` is in the project currency.
 */
export async function costEntryAmounts(
  tx: Prisma.TransactionClient,
  input: CostEntryAmountsInput,
) {
  const [base, project] = await Promise.all([
    organizationBaseCurrency(tx, input.organizationId),
    tx.project.findFirstOrThrow({
      where: { id: input.projectId, organizationId: input.organizationId },
      select: { currencyRef: { select: { code: true, decimals: true } } },
    }),
  ]);
  const projectCurrency = project.currencyRef;
  const originalCurrency = input.currency ?? base.code;
  const exchangeRate =
    originalCurrency === base.code
      ? new Decimal(1)
      : input.exchangeRate !== undefined
        ? new Decimal(input.exchangeRate)
        : await resolveRate(
            tx,
            input.organizationId,
            originalCurrency,
            input.date,
          );
  const projectRate =
    projectCurrency.code === base.code
      ? new Decimal(1)
      : projectCurrency.code === originalCurrency
        ? exchangeRate
        : await resolveRate(
            tx,
            input.organizationId,
            projectCurrency.code,
            input.date,
          );
  const amounts = costAmounts({
    originalCurrency,
    originalAmount: input.amount,
    exchangeRate,
    baseCurrency: base.code,
    baseDecimals: base.decimals,
    projectCurrency: projectCurrency.code,
    projectDecimals: projectCurrency.decimals,
    projectRate,
  });
  return { ...amounts, originalCurrency, exchangeRate, projectRate };
}
