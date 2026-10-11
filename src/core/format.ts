type Amount = { toString(): string } | number | string;

const formatters = new Map<string, Intl.NumberFormat>();

/** Formats an amount for display with Indian digit grouping, e.g. `₹6,30,725.99`. */
export function formatMoney(amount: Amount, currency: string) {
  let formatter = formatters.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      formatter = new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    formatters.set(currency, formatter);
  }
  const value = Number(amount.toString());
  return Number.isFinite(value) ? formatter.format(value) : String(amount);
}
