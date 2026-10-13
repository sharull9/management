import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";
import {
  consumptionInput,
  documentSubmissionInput,
  orderInput,
  procurementFormInput,
  procurementFormSchema,
  procurementServiceInput,
  receiptInput,
  requestInput,
  transferInput,
} from "./schema";
import type { ProcurementItem } from "./type";

function fixture(
  kind: z.input<typeof procurementFormInput>["kind"] = "requests",
): z.input<typeof procurementFormInput> {
  return {
    kind,
    id: null,
    projectId: "project",
    stageId: null,
    taskId: null,
    neededBy: "",
    vendorPartyId: "vendor",
    siteId: null,
    date: "2026-10-11",
    paymentTerms: "CREDIT",
    paymentDays: 30,
    currency: "INR",
    exchangeRate: null,
    receiptTolerancePercent: 2,
    poId: "po",
    receivedDate: "2026-10-11",
    challanNumber: "",
    vehicleNumber: "",
    toProjectId: "destination",
    lines: [
      {
        item: {
          itemId: "item",
          level1: "brand",
          level2: null,
          level3: null,
          level4: null,
          level5: null,
        },
        qty: 2.125,
        uomId: "uom",
        description: "  Material  ",
        estimatedRate: 12.5,
        rate: 10,
        discountPercent: 5,
        taxGroupId: null,
        prLineId: null,
        poLineId: "po-line",
        receivedQty: 3,
        acceptedQty: 2.5,
        rejectedQty: 0.5,
        remarks: "",
      },
    ],
  };
}

test("typed arrays adapt all five document kinds to unchanged service inputs", () => {
  const schemas = {
    requests: requestInput,
    orders: orderInput,
    receipts: receiptInput,
    consumption: consumptionInput,
    transfers: transferInput,
  };
  for (const kind of Object.keys(schemas) as (keyof typeof schemas)[]) {
    const input = procurementFormInput.parse(fixture(kind));
    assert.equal(typeof input.lines[0].qty, "number");
    const parsed = schemas[kind].parse(procurementServiceInput(input));
    assert.equal(parsed.projectId, "project");
    assert.equal(parsed.lines[0].uomId, "uom");
  }
  const request = requestInput.parse(procurementServiceInput(fixture()));
  assert.deepEqual(request.lines[0].levels, ["brand", null, null, null, null]);
  assert.equal(request.lines[0].qty, "2.125");
  assert.equal(request.lines[0].description, "Material");
  assert.equal(request.neededBy, null);
  const receipt = fixture("receipts");
  receipt.challanNumber = "  CH-1  ";
  receipt.vehicleNumber = "   ";
  const parsedReceipt = receiptInput.parse(procurementServiceInput(receipt));
  assert.equal(parsedReceipt.challanNumber, "CH-1");
  assert.equal(parsedReceipt.vehicleNumber, null);
});

test("line arrays require one through 100 typed rows and reject legacy JSON", () => {
  const input = fixture();
  assert.equal(
    procurementFormInput.safeParse({ ...input, lines: [] }).success,
    false,
  );
  assert.equal(
    procurementFormInput.safeParse({
      ...input,
      lines: Array.from({ length: 100 }, () => input.lines[0]),
    }).success,
    true,
  );
  assert.equal(
    procurementFormInput.safeParse({
      ...input,
      lines: Array.from({ length: 101 }, () => input.lines[0]),
    }).success,
    false,
  );
  assert.equal(
    procurementFormInput.safeParse({
      ...input,
      lines: JSON.stringify(input.lines),
    }).success,
    false,
  );
});

test("numeric fields reject cleared, negative, zero quantities and excessive precision", () => {
  for (const kind of [
    "requests",
    "orders",
    "consumption",
    "transfers",
  ] as const) {
    for (const qty of [null, "2", 0, -1, 1.00001, Infinity, NaN]) {
      const input = fixture(kind);
      assert.equal(
        procurementFormInput.safeParse({
          ...input,
          lines: [{ ...input.lines[0], qty }],
        }).success,
        false,
      );
    }
  }
  for (const field of ["rate", "discountPercent"] as const) {
    const input = fixture("orders");
    input.lines[0][field] = -1;
    assert.equal(procurementFormInput.safeParse(input).success, false);
  }
  const input = fixture("orders");
  input.lines[0].discountPercent = 100.0001;
  assert.equal(procurementFormInput.safeParse(input).success, false);
  input.lines[0].discountPercent = 100;
  assert.equal(procurementFormInput.safeParse(input).success, true);
});

test("receipt rows preserve exact accepted plus rejected validation", () => {
  const input = fixture("receipts");
  input.lines[0].receivedQty = 0.3;
  input.lines[0].acceptedQty = 0.1;
  input.lines[0].rejectedQty = 0.2;
  assert.equal(procurementFormInput.safeParse(input).success, true);
  input.lines[0].rejectedQty = 0.1;
  assert.equal(procurementFormInput.safeParse(input).success, false);
  input.lines[0].receivedQty = 0;
  assert.equal(procurementFormInput.safeParse(input).success, false);
});

test("invalid referenced IDs and dates retain nested form error paths", () => {
  const input = fixture();
  input.lines[0].item.itemId = null;
  const result = procurementFormInput.safeParse(input);
  assert.equal(result.success, false);
  if (!result.success)
    assert.ok(
      result.error.issues.some(
        (issue) => issue.path.join(".") === "lines.0.item.itemId",
      ),
    );
  input.lines[0].item.itemId = "item";
  input.lines[0].uomId = null;
  assert.equal(procurementFormInput.safeParse(input).success, false);
  input.lines[0].uomId = "uom";
  input.neededBy = "2026-02-30";
  assert.equal(procurementFormInput.safeParse(input).success, false);
  assert.equal(
    documentSubmissionInput.safeParse({ kind: "consumption", id: "document" })
      .success,
    false,
  );
  assert.equal(
    documentSubmissionInput.safeParse({ kind: "orders", id: "" }).success,
    false,
  );
});

test("client resolver enforces required, linked, disabled variant levels and item units", () => {
  const item: ProcurementItem = {
    id: "item",
    name: "Material",
    uomIds: ["uom"],
    configs: [
      {
        level: 1,
        name: "Brand",
        enabled: true,
        mode: "LINKED",
        required: true,
        values: [
          { id: "brand", name: "Brand" },
          { id: "other", name: "Other" },
        ],
        linkedIds: ["brand"],
      },
    ],
  };
  const schema = procurementFormSchema([item]);
  const input = fixture();
  assert.equal(schema.safeParse(input).success, true);
  for (const level1 of [null, "other", "unknown"]) {
    input.lines[0].item.level1 = level1;
    const result = schema.safeParse(input);
    assert.equal(result.success, false);
    if (!result.success)
      assert.ok(
        result.error.issues.some((i) => i.path.join(".") === "lines.0.item"),
      );
  }
  input.lines[0].item.level1 = "brand";
  input.lines[0].item.level2 = "unused";
  assert.equal(schema.safeParse(input).success, false);
  input.lines[0].item.level2 = null;
  input.lines[0].uomId = "other-unit";
  assert.equal(schema.safeParse(input).success, false);
  input.lines[0].uomId = "uom";
  assert.equal(procurementFormSchema([]).safeParse(input).success, false);
  assert.equal(
    procurementFormSchema([
      { ...item, configs: [{ ...item.configs[0], enabled: false }] },
    ]).safeParse(input).success,
    false,
  );
  // GRNs derive their authoritative variant and unit from the PO in the service.
  assert.equal(
    procurementFormSchema([]).safeParse(fixture("receipts")).success,
    true,
  );
});

test("exchange rates must be positive and are optional for dated resolution", () => {
  const withRate = (exchangeRate: number | null) =>
    procurementFormInput.safeParse({ ...fixture("orders"), exchangeRate });
  assert.equal(withRate(null).success, true);
  assert.equal(withRate(83.5).success, true);
  assert.equal(withRate(0).success, false);
  assert.equal(withRate(-1).success, false);
  const order = orderInput.parse(
    procurementServiceInput(
      procurementFormInput.parse({ ...fixture("orders"), exchangeRate: 83.5 }),
    ),
  );
  assert.equal(order.exchangeRate, "83.5");
  const missing = orderInput.parse(
    procurementServiceInput(procurementFormInput.parse(fixture("orders"))),
  );
  assert.equal(missing.exchangeRate, null);
  const receipt = receiptInput.safeParse({
    ...procurementServiceInput(procurementFormInput.parse(fixture("receipts"))),
    exchangeRate: "0",
  });
  assert.equal(receipt.success, false);
});
