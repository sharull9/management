/** Pads or keeps a stored rate string to exactly 10 decimals, e.g. "83.5" → "83.5000000000". */
export function formatRate(rate: string) {
  const [whole = "0", fraction = ""] = rate.trim().split(".");
  return `${whole}.${fraction.padEnd(10, "0").slice(0, 10)}`;
}

/** "1 USD = 83.5000000000 INR". */
export function describeRate(
  currencyCode: string,
  baseCurrency: string,
  rate: string,
) {
  return `1 ${currencyCode} = ${formatRate(rate)} ${baseCurrency}`;
}
