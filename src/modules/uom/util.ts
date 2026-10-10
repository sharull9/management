import { Decimal, type Numeric } from "@/core/decimal";
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
