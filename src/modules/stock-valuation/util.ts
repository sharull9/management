import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import { toBase } from "@/modules/currency/util";

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
    throw new UserFacingError("Insufficient stock or invalid balance.");
  const unitCost = delta.lt(0)
    ? qty.gt(0)
      ? value.div(qty)
      : new Decimal(0)
    : new Decimal(change.unitCost ?? "0");
  if (!unitCost.isFinite() || unitCost.lt(0))
    throw new UserFacingError("Invalid stock cost.");
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

/**
 * Base-currency value of an accepted goods receipt line.
 * `netRate` is the PO net unit price in the document currency per PO unit and
 * `exchangeRate` the GRN's base-per-document rate. The document value is
 * converted once and rounded at the base currency's decimals, so the stock
 * movement and the ON_RECEIPT cost entry carry the same base amount.
 */
export function receiptValuation(input: {
  acceptedQty: Numeric;
  netRate: Numeric;
  stockQty: Numeric;
  exchangeRate: Numeric;
  baseDecimals: number;
}) {
  const stockQty = new Decimal(input.stockQty);
  if (!stockQty.isFinite() || stockQty.lte(0))
    throw new UserFacingError("Receipt stock quantity must be positive.");
  const documentValue = new Decimal(input.acceptedQty).mul(input.netRate);
  const baseValue = toBase(
    documentValue,
    input.exchangeRate,
    input.baseDecimals,
  );
  return {
    documentValue,
    baseValue,
    unitCost: baseValue.div(stockQty).toDecimalPlaces(8, Decimal.ROUND_HALF_UP),
  };
}
