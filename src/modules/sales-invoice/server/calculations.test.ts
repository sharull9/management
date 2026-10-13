import assert from "node:assert/strict";
import test from "node:test";
import { toBase } from "@/modules/currency/util";
import { movingAverage } from "@/modules/stock-valuation/util";
import type { TaxInput } from "@/modules/tax/util";
import { convertUom } from "@/modules/uom/util";
import {
  calculateInvoiceLine,
  invoiceBaseTotals,
  invoiceTotals,
  isInvoiceOverdue,
  suggestSalesTaxScope,
  validateStockLine,
} from "./calculations";

test("overdue requires an approved outstanding invoice due before today", () => {
  const today = new Date("2026-10-10T12:00:00Z");
  const row = {
    status: "APPROVED",
    dueDate: new Date("2026-10-09T00:00:00Z"),
    payableTotal: "98",
    receivedTotal: "50",
  };
  assert.equal(isInvoiceOverdue(row, today), true);
  assert.equal(
    isInvoiceOverdue(
      { ...row, dueDate: new Date("2026-10-10T00:00:00Z") },
      today,
    ),
    false,
  );
  assert.equal(isInvoiceOverdue({ ...row, status: "DRAFT" }, today), false);
  assert.equal(isInvoiceOverdue({ ...row, receivedTotal: "98" }, today), false);
  assert.equal(isInvoiceOverdue({ ...row, dueDate: null }, today), false);
});

import { invoiceInput } from "../schema";

const components: TaxInput[] = [
  {
    id: "cgst",
    name: "CGST",
    rate: "9",
    isWithholding: false,
    appliesTo: "BOTH",
  },
  {
    id: "sgst",
    name: "SGST",
    rate: "9",
    isWithholding: false,
    appliesTo: "SALES",
  },
  {
    id: "tds",
    name: "TDS",
    rate: "2",
    isWithholding: true,
    appliesTo: "SALES",
  },
  {
    id: "purchase",
    name: "Purchase only",
    rate: "50",
    isWithholding: false,
    appliesTo: "PURCHASE",
  },
];
test("sales tax snapshots and totals separate discount, tax, withholding and settlement", () => {
  const line = calculateInvoiceLine({
    qty: "2",
    rate: "100",
    discountPercent: "10",
    components,
  });
  assert.equal(line.lineSubtotal, "180.00");
  assert.equal(line.lineTotal, "212.40");
  assert.equal(line.taxes.length, 3);
  assert.equal(line.taxes[2].isWithholding, true);
  const service = calculateInvoiceLine({
    qty: "1",
    rate: "50",
    discountPercent: "0",
    components: [],
  });
  assert.deepEqual(invoiceTotals([line, service]), {
    subtotal: "250.00",
    discountTotal: "20.00",
    taxTotal: "32.40",
    withholdingTotal: "3.60",
    grandTotal: "262.40",
    payableTotal: "258.80",
  });
});
test("fractional rates use half-up rounding and preserve total identities", () => {
  const line = calculateInvoiceLine({
    qty: "3",
    rate: "0.335",
    discountPercent: "50",
    components: [],
  });
  assert.equal(line.subtotal, "1.01");
  assert.equal(line.discountTotal, "0.51");
  assert.equal(line.lineSubtotal, "0.50");
  assert.equal(invoiceTotals([line]).grandTotal, "0.50");
});
test("invalid money and excessive withholding are blocked", () => {
  for (const change of [
    { qty: "0" },
    { qty: "-1" },
    { rate: "-1" },
    { rate: "NaN" },
    { discountPercent: "101" },
  ])
    assert.throws(() =>
      calculateInvoiceLine({
        qty: "1",
        rate: "100",
        discountPercent: "0",
        components: [],
        ...change,
      }),
    );
  assert.throws(
    () =>
      calculateInvoiceLine({
        qty: "1",
        rate: "100",
        discountPercent: "0",
        components: [
          { ...components[2], rate: "60" },
          { ...components[2], id: "extra", rate: "60" },
        ],
      }),
    /Withholding/,
  );
});
test("place of supply uses organization state to suggest intra or inter tax", () => {
  assert.equal(suggestSalesTaxScope("TN", "TN"), "INTRA");
  assert.equal(suggestSalesTaxScope("TN", "KA"), "INTER");
  assert.equal(suggestSalesTaxScope(null, "KA"), "ANY");
  assert.equal(suggestSalesTaxScope("TN", null), "ANY");
});
test("project stock excludes services, untracked items and free-text lines", () => {
  const valid = {
    fromProjectStock: true,
    projectId: "project",
    itemVariantId: "variant",
    itemType: "PRODUCT",
    stockTracked: true,
  };
  assert.doesNotThrow(() => validateStockLine(valid));
  for (const change of [
    { projectId: null },
    { itemVariantId: null },
    { itemType: "SERVICE" },
    { stockTracked: false },
  ])
    assert.throws(
      () => validateStockLine({ ...valid, ...change }),
      /Project stock/,
    );
  assert.doesNotThrow(() =>
    validateStockLine({
      fromProjectStock: false,
      projectId: null,
      itemVariantId: null,
    }),
  );
});
test("sales stock conversion and average-cost withdrawals reject overselling and clear depletion", () => {
  const qty = convertUom(
    "2",
    { groupId: "weight", factor: "50" },
    { groupId: "weight", factor: "1" },
  );
  const result = movingAverage(
    { qty: "150", value: "450" },
    { qty: qty.neg() },
  );
  assert.equal(result.qty.toString(), "50");
  assert.equal(result.totalCost.toString(), "-300");
  assert.throws(
    () => movingAverage({ qty: "50", value: "150" }, { qty: qty.neg() }),
    /Insufficient/,
  );
  assert.equal(
    movingAverage({ qty: "3", value: "1" }, { qty: "-3" }).value.toString(),
    "0",
  );
  assert.throws(
    () =>
      convertUom(
        "1",
        { groupId: "weight", factor: "1" },
        { groupId: "weight", factor: "3" },
      ),
    /four decimal/,
  );
});
test("invoice input rejects invalid dates, empty lines and quantity precision", () => {
  const input = {
    id: null,
    projectId: null,
    partyId: "customer",
    date: "2026-10-10",
    dueDate: null,
    stateId: null,
    notes: "",
    lines: [
      {
        itemId: null,
        levels: [],
        description: "Consulting",
        qty: "1",
        uomId: "hour",
        rate: "100",
        discountPercent: "0",
        taxGroupId: null,
        fromProjectStock: false,
      },
    ],
  };
  assert.equal(
    invoiceInput.parse(input).date.toISOString(),
    "2026-10-10T00:00:00.000Z",
  );
  assert.equal(
    invoiceInput.safeParse({ ...input, date: "2026-02-30" }).success,
    false,
  );
  assert.equal(invoiceInput.safeParse({ ...input, lines: [] }).success, false);
  assert.equal(
    invoiceInput.safeParse({
      ...input,
      lines: [{ ...input.lines[0], qty: "1.00001" }],
    }).success,
    false,
  );
});

test("base totals convert each document total once at the invoice rate", () => {
  const totals = {
    subtotal: "100.00",
    discountTotal: "10.00",
    taxTotal: "16.20",
    withholdingTotal: "1.00",
    grandTotal: "106.20",
    payableTotal: "105.20",
  };
  const base = invoiceBaseTotals(totals, (v) => toBase(v, "83.333", 2));
  assert.equal(base.baseSubtotal, "8333.30");
  assert.equal(base.baseTaxTotal, "1349.99");
  assert.equal(base.baseGrandTotal, "8849.96");
  assert.equal(base.basePayableTotal, "8766.63");
  const same = invoiceBaseTotals(totals, (v) => toBase(v, "1", 2));
  assert.equal(same.baseGrandTotal, "106.20");
});
