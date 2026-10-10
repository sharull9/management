import { Decimal, money } from "@/core/decimal";
import { calculateTax, type TaxInput } from "../procurement/calculations";

type Numeric = string | InstanceType<typeof Decimal>;
export function billableQty(
  received: Numeric,
  bills: { qty: Numeric; status: string }[],
) {
  const receipt = new Decimal(received);
  if (!receipt.isFinite() || receipt.lt(0))
    throw new Error("Invalid received quantity.");
  const billed = bills
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => {
      const qty = new Decimal(b.qty);
      if (!qty.isFinite() || qty.lt(0))
        throw new Error("Invalid billed quantity.");
      return sum.add(qty);
    }, new Decimal(0));
  return Decimal.max(0, receipt.sub(billed));
}
export function billVariance(
  qty: Numeric,
  rate: Numeric,
  discount: Numeric,
  poNetRate: Numeric | null,
) {
  return poNetRate === null
    ? money("0")
    : money(
        new Decimal(rate)
          .mul(new Decimal(1).sub(new Decimal(discount).div(100)))
          .sub(poNetRate)
          .mul(qty),
      );
}
export function billableReceipts(
  received: Numeric,
  bills: { qty: Numeric; status: string; grnLineId: string | null }[],
  receipts: { id: string; receivedQty: Numeric }[],
) {
  let remaining = billableQty(received, bills);
  return receipts.flatMap((receipt) => {
    const available = billableQty(
      receipt.receivedQty,
      bills.filter((bill) => bill.grnLineId === receipt.id),
    );
    const qty = Decimal.min(remaining, available);
    remaining = remaining.sub(qty);
    return qty.gt(0) ? [{ grnLineId: receipt.id, qty: qty.toString() }] : [];
  });
}
export function calculateBillLine(
  line: { qty: Numeric; rate: Numeric; discountPercent: Numeric },
  components: TaxInput[],
) {
  const qty = new Decimal(line.qty),
    rate = new Decimal(line.rate),
    discount = new Decimal(line.discountPercent);
  if (
    ![qty, rate, discount].every((v) => v.isFinite()) ||
    qty.lte(0) ||
    rate.lt(0) ||
    discount.lt(0) ||
    discount.gt(100)
  )
    throw new Error("Invalid bill quantity, rate or discount.");
  const subtotal = money(qty.mul(rate));
  const lineSubtotal = money(
    qty.mul(rate).mul(new Decimal(1).sub(discount.div(100))),
  );
  const discountTotal = subtotal.sub(lineSubtotal);
  const taxes = calculateTax(lineSubtotal, components, "PURCHASE");
  return {
    subtotal,
    discountTotal,
    lineSubtotal,
    lineTax: taxes.tax,
    lineTotal: lineSubtotal.add(taxes.tax),
    withholding: taxes.withholding,
    taxes: taxes.lines,
  };
}
export function billTotals(lines: ReturnType<typeof calculateBillLine>[]) {
  const sum = (key: "subtotal" | "discountTotal" | "lineTax" | "withholding") =>
    lines.reduce((s, l) => s.add(l[key]), new Decimal(0));
  const subtotal = sum("subtotal"),
    discountTotal = sum("discountTotal"),
    taxTotal = sum("lineTax"),
    withholdingTotal = sum("withholding");
  const grandTotal = subtotal.sub(discountTotal).add(taxTotal),
    payableTotal = grandTotal.sub(withholdingTotal);
  return {
    subtotal,
    discountTotal,
    taxTotal,
    withholdingTotal,
    grandTotal,
    payableTotal,
  };
}
