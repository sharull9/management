import { Decimal, money } from "@/core/decimal";
import {
  calculateTax,
  suggestTaxScope,
  type TaxInput,
} from "../procurement/calculations";

export const suggestSalesTaxScope = suggestTaxScope;
export function isInvoiceOverdue(
  input: {
    status: string;
    dueDate: Date | null;
    payableTotal: string;
    receivedTotal: string;
  },
  today: Date,
) {
  return (
    ["APPROVED", "PARTIALLY_PAID"].includes(input.status) &&
    !!input.dueDate &&
    input.dueDate.toISOString().slice(0, 10) <
      today.toISOString().slice(0, 10) &&
    new Decimal(input.payableTotal).gt(input.receivedTotal)
  );
}
export function calculateInvoiceLine(input: {
  qty: string;
  rate: string;
  discountPercent: string;
  components: TaxInput[];
}) {
  const qty = new Decimal(input.qty),
    rate = new Decimal(input.rate),
    discount = new Decimal(input.discountPercent);
  if (
    ![qty, rate, discount].every((v) => v.isFinite()) ||
    qty.lte(0) ||
    rate.lt(0) ||
    discount.lt(0) ||
    discount.gt(100)
  )
    throw new Error("Invalid invoice quantity, rate or discount.");
  const subtotal = money(qty.mul(rate));
  const discountTotal = money(subtotal.mul(discount).div(100));
  const lineSubtotal = subtotal.sub(discountTotal);
  const tax = calculateTax(lineSubtotal, input.components, "SALES");
  return {
    subtotal: subtotal.toFixed(2),
    discountTotal: discountTotal.toFixed(2),
    lineSubtotal: lineSubtotal.toFixed(2),
    lineTax: tax.tax.toFixed(2),
    lineTotal: lineSubtotal.add(tax.tax).toFixed(2),
    withholdingTotal: tax.withholding.toFixed(2),
    taxes: tax.lines,
  };
}
export function invoiceTotals(
  lines: ReturnType<typeof calculateInvoiceLine>[],
) {
  const sum = (
    key: "subtotal" | "discountTotal" | "lineTax" | "withholdingTotal",
  ) => lines.reduce((a, l) => a.add(l[key]), new Decimal(0));
  const subtotal = sum("subtotal"),
    discountTotal = sum("discountTotal"),
    taxTotal = sum("lineTax"),
    withholdingTotal = sum("withholdingTotal"),
    grandTotal = subtotal.sub(discountTotal).add(taxTotal),
    payableTotal = grandTotal.sub(withholdingTotal);
  if (payableTotal.lt(0)) throw new Error("Withholding exceeds invoice value.");
  return Object.fromEntries(
    Object.entries({
      subtotal,
      discountTotal,
      taxTotal,
      withholdingTotal,
      grandTotal,
      payableTotal,
    }).map(([k, v]) => [k, v.toFixed(2)]),
  ) as {
    subtotal: string;
    discountTotal: string;
    taxTotal: string;
    withholdingTotal: string;
    grandTotal: string;
    payableTotal: string;
  };
}
export function validateStockLine(input: {
  fromProjectStock: boolean;
  projectId: string | null;
  itemVariantId: string | null;
  itemType?: string;
  stockTracked?: boolean;
}) {
  if (
    input.fromProjectStock &&
    (!input.projectId ||
      !input.itemVariantId ||
      input.itemType === "SERVICE" ||
      !input.stockTracked)
  )
    throw new Error(
      "Project stock requires a project and a stock-tracked goods variant.",
    );
}
