import assert from "node:assert/strict";
import test from "node:test";
import { adjustmentInput } from "./adjustment-schema";

const valid = {
  projectId: "p",
  itemVariantId: "v",
  date: "2026-10-31",
  direction: "INCREASE",
  qty: "1.0001",
  unitCost: "12.12345678",
  reason: " Physical count ",
};
test("stock adjustments require a reason, valid date, bounded positive quantity and increase cost", () => {
  assert.equal(adjustmentInput.parse(valid).reason, "Physical count");
  for (const patch of [
    { reason: " " },
    { qty: "0" },
    { qty: "-1" },
    { qty: "1.00001" },
    { qty: "1e5" },
    { date: "2026-02-30" },
    { unitCost: "" },
    { unitCost: "-1" },
    { unitCost: "Infinity" },
    { unitCost: "1.123456789" },
  ])
    assert.equal(
      adjustmentInput.safeParse({ ...valid, ...patch }).success,
      false,
      JSON.stringify(patch),
    );
  assert.equal(
    adjustmentInput.safeParse({ ...valid, direction: "DECREASE", unitCost: "" })
      .success,
    true,
  );
  assert.equal(
    adjustmentInput.safeParse({ ...valid, unitCost: "0" }).success,
    true,
  );
  assert.equal(
    adjustmentInput.parse({
      ...valid,
      direction: "DECREASE",
      unitCost: "invalid hidden increase cost",
    }).unitCost,
    "",
  );
});
