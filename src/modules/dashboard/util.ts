import { Decimal, type Numeric } from "@/core/decimal";

export type SpendEntry = {
  amount: Numeric;
  baseAmount: Numeric;
  projectCurrency: string;
};

/**
 * Organization-level spend: `base` sums the base-currency amounts (the only
 * figure comparable across projects); `byCurrency` sums project-currency
 * amounts per project currency and is never added together.
 */
export function summariseSpend(entries: SpendEntry[]) {
  let base = new Decimal(0);
  const byCurrency = new Map<string, InstanceType<typeof Decimal>>();
  for (const entry of entries) {
    base = base.add(entry.baseAmount);
    byCurrency.set(
      entry.projectCurrency,
      (byCurrency.get(entry.projectCurrency) ?? new Decimal(0)).add(
        entry.amount,
      ),
    );
  }
  return { base, byCurrency };
}
