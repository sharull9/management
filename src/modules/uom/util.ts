import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
export type Unit = { groupId: string; factor: Numeric };
export function convertUom(qty: Numeric, from: Unit, to: Unit) {
  const amount = new Decimal(qty),
    source = new Decimal(from.factor),
    target = new Decimal(to.factor);
  if (from.groupId !== to.groupId)
    throw new UserFacingError("Units must belong to the same group.");
  if (
    ![amount, source, target].every((n) => n.isFinite()) ||
    source.lte(0) ||
    target.lte(0)
  )
    throw new UserFacingError("Invalid quantity or UOM factor.");
  const result = amount.mul(source).div(target);
  if (!result.eq(result.toDecimalPlaces(4)))
    throw new UserFacingError(
      "Converted quantity exceeds four decimal places.",
    );
  return result;
}
