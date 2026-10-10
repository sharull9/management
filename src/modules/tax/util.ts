import { Decimal, money, type Numeric } from "@/core/decimal";
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
