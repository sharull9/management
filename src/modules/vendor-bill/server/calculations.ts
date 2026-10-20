import { Decimal, money } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import { roundMoney } from "@/modules/currency/util";
import { calculateTax, type TaxInput } from "@/modules/tax/util";

type Numeric = string | InstanceType<typeof Decimal>;
export function billableQty(
  received: Numeric,
  bills: { qty: Numeric; status: string }[],
) {
  const receipt = new Decimal(received);
  if (!receipt.isFinite() || receipt.lt(0))
    throw new UserFacingError("Invalid received quantity.");
  const billed = bills
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => {
      const qty = new Decimal(b.qty);
      if (!qty.isFinite() || qty.lt(0))
        throw new UserFacingError("Invalid billed quantity.");
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
    throw new UserFacingError("Invalid bill quantity, rate or discount.");
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

/**
 * Bill totals converted once per stored total at the bill's rate. The inputs are
 * document-currency totals; tax is always calculated in the document currency first.
 */
export function billBaseTotals(
  totals: ReturnType<typeof billTotals>,
  toBase: (amount: Numeric) => Numeric,
) {
  return {
    baseSubtotal: toBase(totals.subtotal),
    baseDiscountTotal: toBase(totals.discountTotal),
    baseTaxTotal: toBase(totals.taxTotal),
    baseWithholdingTotal: toBase(totals.withholdingTotal),
    baseGrandTotal: toBase(totals.grandTotal),
    basePayableTotal: toBase(totals.payableTotal),
  };
}

/**
 * Base rate of the receipts a bill line is matched to: the linked GRN's own rate,
 * or the accepted-quantity weighted rate of the PO line's approved receipts, or the
 * PO's rate when nothing was received (services and non-stock lines).
 */
export function matchedReceiptRate(
  receipts: { qty: Numeric; rate: Numeric }[],
  fallback: Numeric,
) {
  const total = receipts.reduce((sum, r) => sum.add(r.qty), new Decimal(0));
  if (!total.gt(0)) return new Decimal(fallback);
  return receipts
    .reduce((sum, r) => sum.add(new Decimal(r.qty).mul(r.rate)), new Decimal(0))
    .div(total);
}

/**
 * Bill price variance in BASE currency: the billed line (net of discount, at the
 * bill's rate) minus the matched receipt value (PO net price at the receipt's
 * rate). Both sides are converted once and rounded to base decimals, so the result
 * includes the exchange-rate difference between receipt and bill.
 * Negative when the bill is cheaper than the receipt. Zero without a PO line.
 */
export function billVarianceBase(input: {
  qty: Numeric;
  rate: Numeric;
  discountPercent: Numeric;
  poNetRate: Numeric | null;
  billRate: Numeric;
  receiptRate: Numeric;
  baseDecimals: number;
}) {
  if (input.poNetRate === null) return new Decimal(0);
  const qty = new Decimal(input.qty);
  // PO net rates are snapshotted at eight decimals; match that precision.
  const billNet = new Decimal(input.rate)
    .mul(new Decimal(1).sub(new Decimal(input.discountPercent).div(100)))
    .toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
  const billBase = roundMoney(
    qty.mul(billNet).mul(input.billRate),
    input.baseDecimals,
  );
  const receiptBase = roundMoney(
    qty.mul(input.poNetRate).mul(input.receiptRate),
    input.baseDecimals,
  );
  return billBase.sub(receiptBase);
}

/** A bill linked to a PO or GRN must be in that document's currency. */
export function assertBillCurrency(input: {
  requested: string | null;
  orderCurrency: string | null;
  receiptCurrency?: string | null;
}) {
  if (
    input.orderCurrency &&
    input.requested &&
    input.requested !== input.orderCurrency
  )
    throw new UserFacingError(
      `Bill currency must match the purchase order currency (${input.orderCurrency}).`,
    );
  const currency = input.orderCurrency ?? input.requested;
  if (input.receiptCurrency && currency && input.receiptCurrency !== currency)
    throw new UserFacingError(
      `Bill currency must match the linked receipt currency (${input.receiptCurrency}).`,
    );
}
