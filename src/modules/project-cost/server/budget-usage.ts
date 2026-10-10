import { Decimal, type Numeric } from "@/core/decimal";
export function budgetUsage(budget: Numeric, spent: Numeric) {
  const total = new Decimal(budget);
  const actual = new Decimal(spent);
  return {
    remaining: total.sub(actual),
    percent: total.gt(0)
      ? actual.div(total).mul(100).toDecimalPlaces(2).toString()
      : "0",
  };
}
