import assert from "node:assert/strict";
import { test } from "node:test";
import {
  billAttachmentInput,
  billDocumentInput,
  billFilterInput,
  billInput,
  billUploadInput,
} from "../schema";
import { billFormData } from "../util";

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

test("typed bill upload round-trips raw RHF dates, nested receipt ids and an optional file", () => {
  const file = new File(["invoice"], "invoice.pdf", {
    type: "application/pdf",
  });
  const payload = {
    ...draft,
    purchaseOrderId: "order",
    lines: [
      {
        ...draft.lines[0],
        poLineId: "order-line",
        grnLineId: "receipt-line",
        itemVariantId: "variant",
        taxGroupId: "tax",
      },
    ],
  };
  const data = billFormData(payload, file);
  const value = billUploadInput.parse(data);
  assert.equal(value.date.toISOString(), "2026-10-10T00:00:00.000Z");
  assert.equal(value.lines[0].grnLineId, "receipt-line");
  assert.equal(value.lines[0].taxGroupId, "tax");
  assert.equal(value.attachment?.name, "invoice.pdf");
  assert.equal(billUploadInput.parse(billFormData(draft)).attachment, null);
  assert.equal(billInput.safeParse({ ...draft, dueDate: "" }).success, false);
  assert.equal(
    billUploadInput.parse(billFormData({ ...draft, dueDate: "" })).dueDate,
    null,
  );
});

test("typed bill payload rejects malformed JSON and reports nested field paths", () => {
  for (const payload of ["{", "null", "[]", "42", "", "x".repeat(250001)]) {
    const data = new FormData();
    data.set("payload", payload);
    assert.equal(billUploadInput.safeParse(data).success, false);
  }
  assert.equal(billUploadInput.safeParse(new FormData()).success, false);
  const invalid = billUploadInput.safeParse(
    billFormData({ ...draft, lines: [{ ...draft.lines[0], qty: "0" }] }),
  );
  assert.equal(invalid.success, false);
  if (!invalid.success)
    assert.ok(
      invalid.error.issues.some(
        (issue) => issue.path.join(".") === "lines.0.qty",
      ),
    );
  assert.equal(
    billUploadInput.safeParse(billFormData({ ...draft, projectId: "" }))
      .success,
    false,
  );
  assert.equal(
    billUploadInput.safeParse(
      billFormData({
        ...draft,
        lines: Array.from({ length: 101 }, () => draft.lines[0]),
      }),
    ).success,
    false,
  );
});

test("bill attachments validate MIME type and the existing 900 KB limit", () => {
  for (const file of [
    new File([], "empty.pdf", { type: "application/pdf" }),
    new File(["x"], "bad.txt", { type: "text/plain" }),
    new File([new Uint8Array(900001)], "large.png", { type: "image/png" }),
  ]) {
    assert.equal(billAttachmentInput.safeParse(file).success, false);
    assert.equal(
      billUploadInput.safeParse(billFormData(draft, file)).success,
      false,
    );
  }
  for (const type of ["application/pdf", "image/png", "image/jpeg"])
    assert.equal(
      billAttachmentInput.safeParse(
        new File([new Uint8Array(900000)], "invoice", { type }),
      ).success,
      true,
    );
  const data = billFormData(draft);
  data.set("attachment", "not a file");
  assert.equal(billUploadInput.safeParse(data).success, false);
});

test("bill submission and filter inputs validate ids and enum choices", () => {
  assert.equal(billDocumentInput.safeParse({ id: "" }).success, false);
  assert.equal(
    billFilterInput.safeParse({
      projectId: null,
      partyId: null,
      status: "DRAFT",
      overdue: "1",
    }).success,
    true,
  );
  assert.equal(
    billFilterInput.safeParse({
      projectId: null,
      partyId: null,
      status: "UNKNOWN",
      overdue: null,
    }).success,
    false,
  );
});
