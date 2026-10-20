import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";

/** Fraction digits stored for exchange rates (Decimal(20,10)). */
export const RATE_DECIMALS = 10;

/** Money columns are Decimal(18,2); currencies with more minor-unit digits cannot be stored exactly. */
export const MAX_STORED_DECIMALS = 2;

export function assertStorableCurrency(code: string, decimals: number) {
  if (decimals > MAX_STORED_DECIMALS)
    throw new UserFacingError(
      `${code} uses ${decimals} decimal places; amounts are stored to ${MAX_STORED_DECIMALS} decimals, so it is not supported yet.`,
    );
}

/** Rounds half away from zero, so negative amounts mirror positive ones. */
export function roundMoney(value: Numeric, decimals: number) {
  return new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

/** Rounds every total to the document currency's decimals (columns store two). */
export function roundTotals<T extends Record<string, Numeric>>(
  totals: T,
  decimals: number,
) {
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      roundMoney(value, decimals),
    ]),
  ) as { [K in keyof T]: ReturnType<typeof roundMoney> };
}

export function assertPositiveRate(rate: Numeric, label = "Exchange rate") {
  const value = new Decimal(rate);
  if (!value.isFinite() || !value.gt(0))
    throw new UserFacingError(`${label} must be greater than zero.`);
  return value;
}

/** Document amount -> base amount. `rate` is base units per 1 document unit. */
export function toBase(amount: Numeric, rate: Numeric, baseDecimals: number) {
  return roundMoney(
    new Decimal(amount).mul(assertPositiveRate(rate)),
    baseDecimals,
  );
}

/** Base amount -> amount in another currency. `rate` is base units per 1 unit of it. */
export function fromBase(baseAmount: Numeric, rate: Numeric, decimals: number) {
  return roundMoney(
    new Decimal(baseAmount).div(assertPositiveRate(rate)),
    decimals,
  );
}

export type CostAmountsInput = {
  originalCurrency: string;
  originalAmount: Numeric;
  /** Base units per 1 unit of originalCurrency. Ignored (1) when it is the base currency. */
  exchangeRate: Numeric;
  baseCurrency: string;
  baseDecimals: number;
  projectCurrency: string;
  projectDecimals: number;
  /** Base units per 1 unit of the project currency. Ignored (1) when it is the base currency. */
  projectRate: Numeric;
};

/**
 * Computes the three stored cost amounts.
 * - baseAmount = originalAmount x exchangeRate, rounded to base decimals.
 * - amount (project currency) equals originalAmount exactly when the original
 *   currency is the project currency; otherwise baseAmount / projectRate rounded
 *   to the project currency's decimals.
 */
export function costAmounts(input: CostAmountsInput) {
  const original = new Decimal(input.originalAmount);
  const rate =
    input.originalCurrency === input.baseCurrency
      ? new Decimal(1)
      : assertPositiveRate(input.exchangeRate);
  const baseAmount = toBase(original, rate, input.baseDecimals);
  if (input.originalCurrency === input.projectCurrency)
    return { originalAmount: original, baseAmount, amount: original };
  const projectRate =
    input.projectCurrency === input.baseCurrency
      ? new Decimal(1)
      : assertPositiveRate(input.projectRate, "Project exchange rate");
  return {
    originalAmount: original,
    baseAmount,
    amount: fromBase(baseAmount, projectRate, input.projectDecimals),
  };
}

export type PaymentDirectionKind = "OUTGOING" | "INCOMING";

/**
 * Realised FX on one allocation. `amount` is in the shared document/payment
 * currency. fxDifference = baseAmount - documentBaseAmount.
 *
 * Sign convention: payables (OUTGOING payments against vendor bills): a positive
 * difference means more base currency left than the bill carried = LOSS.
 * Receivables (INCOMING receipts against sales invoices): a positive difference
 * means more base currency arrived than invoiced = GAIN.
 */
export function realisedFx(input: {
  amount: Numeric;
  paymentRate: Numeric;
  documentRate: Numeric;
  baseDecimals: number;
  direction: PaymentDirectionKind;
}) {
  const baseAmount = toBase(
    input.amount,
    input.paymentRate,
    input.baseDecimals,
  );
  const documentBaseAmount = toBase(
    input.amount,
    input.documentRate,
    input.baseDecimals,
  );
  const fxDifference = baseAmount.sub(documentBaseAmount);
  const outcome: "GAIN" | "LOSS" | "NONE" = fxDifference.isZero()
    ? "NONE"
    : (input.direction === "OUTGOING") === fxDifference.gt(0)
      ? "LOSS"
      : "GAIN";
  return { baseAmount, documentBaseAmount, fxDifference, outcome };
}

/** Allocation is only allowed between documents of the same currency. */
export function assertSameCurrency(
  paymentCurrency: string,
  documentCurrency: string,
  context = "Payment",
) {
  if (paymentCurrency !== documentCurrency)
    throw new UserFacingError(
      `${context} is in ${paymentCurrency} but the document is in ${documentCurrency}. Allocations must use the same currency.`,
    );
}
