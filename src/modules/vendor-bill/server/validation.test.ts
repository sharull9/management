import assert from "node:assert/strict";
import { test } from "node:test";
import { billInput } from "../schema";

const draft = {
  id: null,
  projectId: "project",
  partyId: "vendor",
  purchaseOrderId: null,
  date: "2026-10-10",
  vendorInvoiceNo: "  INV-001  ",
  vendorInvoiceDate: "2026-10-09",
  dueDate: null,
  lines: [
    {
      description: "Service",
      qty: "1.2345",
      uomId: "unit",
      rate: "100.1234",
      discountPercent: "10",
      taxGroupId: null,
    },
  ],
};
test("direct bills validate dates and decimal precision and normalize invoice numbers", () => {
  const value = billInput.parse(draft);
  assert.equal(value.vendorInvoiceNo, "INV-001");
  assert.equal(value.date.toISOString(), "2026-10-10T00:00:00.000Z");
  assert.equal(value.lines[0].poLineId, null);
  assert.equal(value.lines[0].grnLineId, null);
  assert.equal(value.lines[0].itemVariantId, null);
  assert.equal(
    billInput.safeParse({ ...draft, date: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    billInput.safeParse({ ...draft, vendorInvoiceNo: " " }).success,
    false,
  );
  assert.equal(billInput.safeParse({ ...draft, lines: [] }).success, false);
  for (const fields of [
    { qty: "0" },
    { qty: "-1" },
    { qty: "1.00001" },
    { rate: "NaN" },
    { discountPercent: "101" },
    { description: "" },
  ]) {
    assert.equal(
      billInput.safeParse({
        ...draft,
        lines: [{ ...draft.lines[0], ...fields }],
      }).success,
      false,
    );
  }
});
