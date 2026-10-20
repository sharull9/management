import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import { toBase } from "@/modules/currency/util";

/** Base-currency value of an expense: converted once from the expense total. */
export function expenseBaseAmount(
  amount: Numeric,
  exchangeRate: Numeric,
  baseDecimals: number,
) {
  return toBase(amount, exchangeRate, baseDecimals);
}

/** Rejects amounts with more fraction digits than the currency supports. */
export function assertCurrencyPrecision(
  amount: Numeric,
  decimals: number,
  code: string,
) {
  if (new Decimal(amount).decimalPlaces() > decimals)
    throw new UserFacingError(
      `${code} amounts support at most ${decimals} decimal places.`,
    );
}
