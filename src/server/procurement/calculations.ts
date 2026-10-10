import { Prisma } from "../../generated/prisma/browser";
import type { Prisma as ServerPrisma } from "../../generated/prisma/client";

type Numeric = string | ServerPrisma.Decimal;
export const Decimal = Prisma.Decimal.clone({ precision: 48 });
export const money = (value: Numeric) =>
  new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export type Unit = { groupId: string; factor: Numeric };
export function convertUom(qty: Numeric, from: Unit, to: Unit) {
  const amount = new Decimal(qty),
    source = new Decimal(from.factor),
    target = new Decimal(to.factor);
  if (from.groupId !== to.groupId)
    throw new Error("Units must belong to the same group.");
  if (
    ![amount, source, target].every((n) => n.isFinite()) ||
    source.lte(0) ||
    target.lte(0)
  )
    throw new Error("Invalid quantity or UOM factor.");
  const result = amount.mul(source).div(target);
  if (!result.eq(result.toDecimalPlaces(4)))
    throw new Error("Converted quantity exceeds four decimal places.");
  return result;
}
export function suggestTaxScope(
  orgState: string | null,
  partyState: string | null,
) {
  return orgState && partyState
    ? orgState === partyState
      ? "INTRA"
      : "INTER"
    : "ANY";
}
export type TaxInput = {
  id: string;
  name: string;
  rate: Numeric;
  isWithholding: boolean;
  appliesTo: "PURCHASE" | "SALES" | "BOTH";
};
export function calculateTax(
  taxable: Numeric,
  components: TaxInput[],
  appliesTo: "PURCHASE" | "SALES" = "PURCHASE",
) {
  const base = new Decimal(taxable);
  if (!base.isFinite() || base.lt(0))
    throw new Error("Invalid taxable amount.");
  const lines = components
    .filter((c) => c.appliesTo === "BOTH" || c.appliesTo === appliesTo)
    .map((c) => {
      const rate = new Decimal(c.rate);
      if (!rate.isFinite() || rate.lt(0) || rate.gt(100))
        throw new Error("Invalid tax rate.");
      return {
        componentId: c.id,
        name: c.name,
        rate: rate.toString(),
        amount: money(base.mul(rate).div(100)).toFixed(2),
        isWithholding: c.isWithholding,
      };
    });
  const tax = lines
    .filter((l) => !l.isWithholding)
    .reduce((a, l) => a.add(l.amount), new Decimal(0));
  const withholding = lines
    .filter((l) => l.isWithholding)
    .reduce((a, l) => a.add(l.amount), new Decimal(0));
  const total = money(base.add(tax).sub(withholding));
  if (total.lt(0)) throw new Error("Withholding exceeds the invoice value.");
  return {
    lines,
    tax,
    withholding,
    total,
  };
}
export function assertReceiptQuantity(
  ordered: Numeric,
  received: Numeric,
  incoming: Numeric,
  tolerance: Numeric = "0",
) {
  const quantities = [ordered, received, incoming, tolerance].map(
    (q) => new Decimal(q),
  );
  if (quantities.some((q) => !q.isFinite() || q.lt(0)) || quantities[3].gt(100))
    throw new Error("Invalid receipt quantity or tolerance.");
  if (
    quantities[1]
      .add(quantities[2])
      .gt(quantities[0].mul(new Decimal(1).add(quantities[3].div(100))))
  )
    throw new Error(
      "Received quantity exceeds the ordered quantity and tolerance.",
    );
}
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

export type MaterialCostMode = "ON_RECEIPT" | "ON_CONSUMPTION";
export function materialCostEffects(input: {
  event: "GRN" | "CONSUMPTION" | "TRANSFER";
  sourceMode: MaterialCostMode;
  destMode?: MaterialCostMode;
  value: Numeric;
}): { projectSide: "source" | "destination"; amount: string }[] {
  const rawValue = new Decimal(input.value);
  if (!rawValue.isFinite() || rawValue.lt(0))
    throw new Error("Invalid material value.");
  const value = money(rawValue);
  if (input.event === "TRANSFER") {
    if (!input.destMode)
      throw new Error("Destination recognition mode is required.");
    return [
      ...(input.sourceMode === "ON_RECEIPT"
        ? [{ projectSide: "source" as const, amount: value.neg().toFixed(2) }]
        : []),
      ...(input.destMode === "ON_RECEIPT"
        ? [{ projectSide: "destination" as const, amount: value.toFixed(2) }]
        : []),
    ];
  }
  const recognize =
    input.event === "GRN"
      ? input.sourceMode === "ON_RECEIPT"
      : input.sourceMode === "ON_CONSUMPTION";
  return recognize ? [{ projectSide: "source", amount: value.toFixed(2) }] : [];
}

export function assertCostRecognitionChange(input: {
  oldMode: MaterialCostMode;
  newMode: MaterialCostMode;
  hasStockMovements: boolean;
  confirmed: boolean;
}) {
  if (
    input.oldMode !== input.newMode &&
    input.hasStockMovements &&
    !input.confirmed
  )
    throw new Error(
      "Confirm that this change applies only to future transactions; past cost entries are not restated.",
    );
}
