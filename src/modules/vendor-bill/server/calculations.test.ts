import assert from "node:assert/strict";
import { test } from "node:test";
import {
  billableQty,
  billableReceipts,
  billTotals,
  billVariance,
  calculateBillLine,
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
