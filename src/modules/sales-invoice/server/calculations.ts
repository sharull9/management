import { Decimal, money } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import { roundMoney } from "@/modules/currency/util";
import {
  calculateTax,
  suggestTaxScope,
  type TaxInput,
} from "@/modules/tax/util";

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
    throw new UserFacingError("Invalid invoice quantity, rate or discount.");
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
/** `decimals` is the document currency's own decimals (0 for JPY). */
export function invoiceTotals(
  lines: ReturnType<typeof calculateInvoiceLine>[],
  decimals = 2,
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
  if (payableTotal.lt(0))
    throw new UserFacingError("Withholding exceeds invoice value.");
  return Object.fromEntries(
    Object.entries({
      subtotal,
      discountTotal,
      taxTotal,
      withholdingTotal,
      grandTotal,
      payableTotal,
    }).map(([k, v]) => [k, roundMoney(v, decimals).toFixed(2)]),
  ) as {
    subtotal: string;
    discountTotal: string;
    taxTotal: string;
    withholdingTotal: string;
    grandTotal: string;
    payableTotal: string;
  };
}
/**
 * Base-currency totals, each converted once from its document-currency total
 * (never summed from rounded line conversions).
 */
export function invoiceBaseTotals(
  totals: ReturnType<typeof invoiceTotals>,
  toBase: (amount: string) => { toFixed: (places: number) => string },
) {
  return {
    baseSubtotal: toBase(totals.subtotal).toFixed(2),
    baseDiscountTotal: toBase(totals.discountTotal).toFixed(2),
    baseTaxTotal: toBase(totals.taxTotal).toFixed(2),
    baseWithholdingTotal: toBase(totals.withholdingTotal).toFixed(2),
    baseGrandTotal: toBase(totals.grandTotal).toFixed(2),
    basePayableTotal: toBase(totals.payableTotal).toFixed(2),
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
    throw new UserFacingError(
      "Project stock requires a project and a stock-tracked goods variant.",
    );
}
