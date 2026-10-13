import assert from "node:assert/strict";
import { test } from "node:test";
import { Decimal } from "@/core/decimal";
import {
  assertBillCurrency,
  billableQty,
  billableReceipts,
  billBaseTotals,
  billTotals,
  billVariance,
  billVarianceBase,
  calculateBillLine,
  matchedReceiptRate,
} from "./calculations";

test("prefill splits partial receipts and caps GRN allocations by total PO balance", () => {
  assert.deepEqual(
    billableReceipts(
      "10",
      [
        { qty: "2", status: "DRAFT", grnLineId: "a" },
        { qty: "3", status: "APPROVED", grnLineId: null },
        { qty: "6", status: "CANCELLED", grnLineId: "b" },
      ],
      [
        { id: "a", receivedQty: "4" },
        { id: "b", receivedQty: "6" },
      ],
    ),
    [
      { grnLineId: "a", qty: "2" },
      { grnLineId: "b", qty: "3" },
    ],
  );
  assert.deepEqual(
    billableReceipts(
      "1",
      [{ qty: "1", status: "PAID", grnLineId: "a" }],
      [{ id: "a", receivedQty: "1" }],
    ),
    [],
  );
});

test("received quantity reserves drafts, pending, approved and paid bills, excluding cancelled", () => {
  assert.equal(
    billableQty("10", [
      { qty: "2", status: "DRAFT" },
      { qty: "1", status: "PENDING_APPROVAL" },
      { qty: "3", status: "PAID" },
      { qty: "100", status: "CANCELLED" },
    ]).toString(),
    "4",
  );
  assert.equal(
    billableQty("2", [{ qty: "3", status: "APPROVED" }]).toString(),
    "0",
  );
  assert.throws(() => billableQty("-1", []));
  assert.throws(() => billableQty("1", [{ qty: "NaN", status: "DRAFT" }]));
});
test("variance uses discounted bill rate against PO net rate, with signed discounts", () => {
  assert.equal(billVariance("2.5", "120", "10", "100").toFixed(2), "20.00");
  assert.equal(billVariance("2", "100", "20", "90").toFixed(2), "-20.00");
  assert.equal(billVariance("2", "500", "0", null).toFixed(2), "0.00");
});
test("bill totals separate withholding from grand total and snapshot purchase taxes", () => {
  const line = calculateBillLine(
    { qty: "2", rate: "100", discountPercent: "10" },
    [
      {
        id: "gst",
        name: "GST",
        rate: "18",
        isWithholding: false,
        appliesTo: "PURCHASE",
      },
      {
        id: "tds",
        name: "TDS",
        rate: "2",
        isWithholding: true,
        appliesTo: "BOTH",
      },
      {
        id: "sales",
        name: "Sales",
        rate: "10",
        isWithholding: false,
        appliesTo: "SALES",
      },
    ],
  );
  const totals = billTotals([line]);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(totals).map(([k, v]) => [k, v.toFixed(2)]),
    ),
    {
      subtotal: "200.00",
      discountTotal: "20.00",
      taxTotal: "32.40",
      withholdingTotal: "3.60",
      grandTotal: "212.40",
      payableTotal: "208.80",
    },
  );
  assert.equal(line.taxes.length, 2);
  assert.equal(line.lineTotal.toFixed(2), "212.40");
});
test("discount rounding reconciles document and line totals", () => {
  const line = calculateBillLine(
    { qty: "0.3333", rate: "1", discountPercent: "50" },
    [],
  );
  const total = billTotals([line, line]);
  assert.equal(total.grandTotal.toFixed(2), "0.34");
  assert.equal(total.subtotal.sub(total.discountTotal).toFixed(2), "0.34");
  assert.throws(() =>
    calculateBillLine({ qty: "0", rate: "1", discountPercent: "0" }, []),
  );
  assert.throws(() =>
    calculateBillLine({ qty: "1", rate: "1", discountPercent: "101" }, []),
  );
});

test("USD PO at 83, received at 84 and billed at 85 posts the FX difference as variance", () => {
  const input = {
    qty: "10",
    rate: "100",
    discountPercent: "0",
    poNetRate: "100",
    baseDecimals: 2,
  };
  // Receipt valued 10 x 100 x 84 = 84,000; bill 10 x 100 x 85 = 85,000.
  const fx = billVarianceBase({ ...input, billRate: "85", receiptRate: "84" });
  assert.equal(fx.toFixed(2), "1000.00");
  // Price and FX together: bill at 101 USD -> 85,850 - 84,000.
  const both = billVarianceBase({
    ...input,
    rate: "101",
    billRate: "85",
    receiptRate: "84",
  });
  assert.equal(both.toFixed(2), "1850.00");
  // The PO rate (83) is irrelevant once the receipt has been valued at 84.
  const cheaper = billVarianceBase({
    ...input,
    billRate: "84",
    receiptRate: "84",
  });
  assert.equal(cheaper.toFixed(2), "0.00");
  const credit = billVarianceBase({
    ...input,
    billRate: "83",
    receiptRate: "84",
  });
  assert.equal(credit.toFixed(2), "-1000.00");
});

test("base variance honours discounts and is zero without a PO line", () => {
  assert.equal(
    billVarianceBase({
      qty: "4",
      rate: "50",
      discountPercent: "10",
      poNetRate: "45",
      billRate: "1",
      receiptRate: "1",
      baseDecimals: 2,
    }).toFixed(2),
    "0.00",
  );
  assert.equal(
    billVarianceBase({
      qty: "4",
      rate: "50",
      discountPercent: "0",
      poNetRate: null,
      billRate: "85",
      receiptRate: "84",
      baseDecimals: 2,
    }).toFixed(2),
    "0.00",
  );
});

test("single-currency variance equals the document-currency price variance", () => {
  const price = billVariance("7", "12.5", "5", "11.5");
  const base = billVarianceBase({
    qty: "7",
    rate: "12.5",
    discountPercent: "5",
    poNetRate: "11.5",
    billRate: "1",
    receiptRate: "1",
    baseDecimals: 2,
  });
  assert.equal(base.toFixed(2), price.toFixed(2));
});

test("matched receipt rate is the linked rate, the accepted-qty weighted rate or the PO rate", () => {
  assert.equal(
    matchedReceiptRate([{ qty: "10", rate: "84" }], "83").toFixed(2),
    "84.00",
  );
  assert.equal(
    matchedReceiptRate(
      [
        { qty: "10", rate: "84" },
        { qty: "30", rate: "86" },
      ],
      "83",
    ).toFixed(2),
    "85.50",
  );
  assert.equal(matchedReceiptRate([], "83").toFixed(2), "83.00");
});

test("base totals convert each stored total once at the bill rate", () => {
  const lines = [
    calculateBillLine({ qty: "3", rate: "10.333", discountPercent: "0" }, []),
    calculateBillLine({ qty: "1", rate: "0.01", discountPercent: "0" }, []),
  ];
  const totals = billTotals(lines);
  const rate = "83.456789";
  const base = billBaseTotals(totals, (amount) =>
    new Decimal(amount.toString()).mul(rate).toDecimalPlaces(2),
  );
  assert.equal(
    new Decimal(base.baseGrandTotal.toString()).toFixed(2),
    totals.grandTotal.mul(rate).toDecimalPlaces(2).toFixed(2),
  );
  assert.equal(new Decimal(base.baseSubtotal.toString()).toFixed(2), "2588.00");
});

test("a bill must use the linked PO and receipt currency", () => {
  assert.doesNotThrow(() =>
    assertBillCurrency({ requested: "USD", orderCurrency: "USD" }),
  );
  assert.doesNotThrow(() =>
    assertBillCurrency({ requested: null, orderCurrency: "USD" }),
  );
  assert.throws(
    () => assertBillCurrency({ requested: "EUR", orderCurrency: "USD" }),
    /purchase order currency \(USD\)/,
  );
  assert.throws(
    () =>
      assertBillCurrency({
        requested: "INR",
        orderCurrency: null,
        receiptCurrency: "USD",
      }),
    /receipt currency \(USD\)/,
  );
});
