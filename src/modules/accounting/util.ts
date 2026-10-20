import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import type { DecimalValue, JournalLineSnapshot } from "./type";

const isDecimalText = (value: Numeric) =>
  /^-?\d{1,16}(?:\.\d+)?$/.test(String(value));

export function validateJournalLines(
  lines: readonly { debit: Numeric; credit: Numeric }[],
  decimals = 2,
): { debit: DecimalValue; credit: DecimalValue } {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 2)
    throw new UserFacingError(
      "Currency precision must be between zero and two decimals.",
    );
  if (lines.length < 2)
    throw new UserFacingError("A journal requires at least two lines.");
  let debit = new Decimal(0);
  let credit = new Decimal(0);
  for (const line of lines) {
    if (!isDecimalText(line.debit) || !isDecimalText(line.credit))
      throw new UserFacingError(
        "Journal amounts must be finite decimal strings.",
      );
    const d = new Decimal(line.debit);
    const c = new Decimal(line.credit);
    if (!d.isFinite() || !c.isFinite())
      throw new UserFacingError("Journal amounts must be finite.");
    if (d.lt(0) || c.lt(0))
      throw new UserFacingError("Journal amounts cannot be negative.");
    if (d.decimalPlaces() > decimals || c.decimalPlaces() > decimals)
      throw new UserFacingError(
        `Journal amounts support at most ${decimals} decimal places.`,
      );
    if (d.isZero() === c.isZero())
      throw new UserFacingError(
        "Each line must have exactly one positive side.",
      );
    debit = debit.add(d);
    credit = credit.add(c);
  }
  if (debit.isZero() || credit.isZero())
    throw new UserFacingError("Journal totals must be greater than zero.");
  if (!debit.eq(credit))
    throw new UserFacingError("Journal debits and credits must balance.");
  return { debit, credit };
}

export function accountBalance(
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE",
  debit: Numeric,
  credit: Numeric,
): DecimalValue {
  const d = new Decimal(debit);
  const c = new Decimal(credit);
  return type === "ASSET" || type === "EXPENSE" ? d.sub(c) : c.sub(d);
}

export function allocateBaseAmounts(
  total: Numeric,
  weights: readonly Numeric[],
  decimals = 2,
): DecimalValue[] {
  const amount = new Decimal(total);
  if (!isDecimalText(total) || !amount.isFinite() || amount.lt(0))
    throw new UserFacingError(
      "Allocation total must be finite and non-negative.",
    );
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 2)
    throw new UserFacingError(
      "Currency precision must be between zero and two decimals.",
    );
  if (amount.decimalPlaces() > decimals)
    throw new UserFacingError("Allocation total exceeds currency precision.");
  const parsed = weights.map((weight) => {
    if (!isDecimalText(weight))
      throw new UserFacingError(
        "Allocation weights must be finite decimal strings.",
      );
    const value = new Decimal(weight);
    if (!value.isFinite() || value.lt(0))
      throw new UserFacingError("Allocation weights must be non-negative.");
    return value;
  });
  if (parsed.length === 0) {
    if (amount.isZero()) return [];
    throw new UserFacingError("A positive total requires at least one weight.");
  }
  const weightTotal = parsed.reduce(
    (sum, value) => sum.add(value),
    new Decimal(0),
  );
  if (weightTotal.isZero()) {
    if (amount.isZero()) return parsed.map(() => new Decimal(0));
    throw new UserFacingError("A positive total requires positive weights.");
  }
  const unit = new Decimal(1).div(new Decimal(10).pow(decimals));
  const factor = new Decimal(10).pow(decimals);
  const targetUnits = amount.mul(factor).toDecimalPlaces(0, Decimal.ROUND_DOWN);
  const shares = parsed.map((weight) =>
    amount.mul(weight).div(weightTotal).mul(factor),
  );
  const units = shares.map((share) =>
    share.toDecimalPlaces(0, Decimal.ROUND_DOWN),
  );
  let remaining = targetUnits.sub(
    units.reduce((sum, value) => sum.add(value), new Decimal(0)),
  );
  const order = shares
    .map((share, index) => {
      const unitsAtIndex = units[index];
      if (!unitsAtIndex) throw new Error("Allocation invariant failed.");
      return { index, remainder: share.sub(unitsAtIndex) };
    })
    .sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index);
  for (let i = 0; remaining.gt(0); i += 1) {
    const target = order[i % order.length];
    if (!target) throw new Error("Allocation invariant failed.");
    const current = units[target.index];
    if (!current) throw new Error("Allocation invariant failed.");
    units[target.index] = current.add(1);
    remaining = remaining.sub(1);
  }
  return units.map((value) => value.mul(unit));
}

export function reverseLines<T extends JournalLineSnapshot>(
  lines: readonly T[],
): T[] {
  return lines.map((line) => ({
    ...line,
    debit: line.credit,
    credit: line.debit,
    ...(line.taxBaseAmount == null
      ? {}
      : { taxBaseAmount: new Decimal(line.taxBaseAmount).negated() }),
  }));
}
