import { Decimal, type Numeric } from "@/core/decimal";

export function movingAverage(
  balance: { qty: Numeric; value: Numeric },
  change: { qty: Numeric; unitCost?: Numeric },
) {
  const qty = new Decimal(balance.qty),
    value = new Decimal(balance.value),
    delta = new Decimal(change.qty);
  if (
    ![qty, value, delta].every((v) => v.isFinite()) ||
    qty.lt(0) ||
    value.lt(0) ||
    qty.add(delta).lt(0)
  )
    throw new Error("Insufficient stock or invalid balance.");
  const unitCost = delta.lt(0)
    ? qty.gt(0)
      ? value.div(qty)
      : new Decimal(0)
    : new Decimal(change.unitCost ?? "0");
  if (!unitCost.isFinite() || unitCost.lt(0))
    throw new Error("Invalid stock cost.");
  const totalCost = delta.eq(qty.neg())
    ? value.neg()
    : delta.mul(unitCost).toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
  const nextQty = qty.add(delta),
    nextValue = value.add(totalCost);
  return {
    qty: nextQty,
    value: nextValue,
    avgCost: nextQty.gt(0) ? nextValue.div(nextQty) : new Decimal(0),
    unitCost: unitCost.toDecimalPlaces(8, Decimal.ROUND_HALF_UP),
    totalCost,
  };
}
