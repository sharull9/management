import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCostRecognitionChange,
  type MaterialCostMode,
  materialCostEffects,
} from "./calculations";

for (const sourceMode of [
  "ON_RECEIPT",
  "ON_CONSUMPTION",
] as MaterialCostMode[]) {
  test(`GRN and consumption for ${sourceMode}`, () => {
    for (const event of ["GRN", "CONSUMPTION"] as const) {
      const recognizes =
        event === "GRN"
          ? sourceMode === "ON_RECEIPT"
          : sourceMode === "ON_CONSUMPTION";
      assert.deepEqual(
        materialCostEffects({ event, sourceMode, value: "123.456" }),
        recognizes ? [{ projectSide: "source", amount: "123.46" }] : [],
      );
    }
  });
  for (const destMode of [
    "ON_RECEIPT",
    "ON_CONSUMPTION",
  ] as MaterialCostMode[]) {
    test(`transfer ${sourceMode} to ${destMode}`, () => {
      assert.deepEqual(
        materialCostEffects({
          event: "TRANSFER",
          sourceMode,
          destMode,
          value: "123.455",
        }),
        [
          ...(sourceMode === "ON_RECEIPT"
            ? [{ projectSide: "source", amount: "-123.46" }]
            : []),
          ...(destMode === "ON_RECEIPT"
            ? [{ projectSide: "destination", amount: "123.46" }]
            : []),
        ],
      );
    });
  }
}
test("invalid values and missing transfer mode are rejected", () => {
  for (const value of ["-0.001", "NaN", "Infinity"])
    assert.throws(() =>
      materialCostEffects({ event: "GRN", sourceMode: "ON_RECEIPT", value }),
    );
  assert.throws(() =>
    materialCostEffects({
      event: "TRANSFER",
      sourceMode: "ON_RECEIPT",
      value: "1",
    }),
  );
  assert.deepEqual(
    materialCostEffects({ event: "GRN", sourceMode: "ON_RECEIPT", value: "0" }),
    [{ projectSide: "source", amount: "0.00" }],
  );
});
test("changing recognition with stock history requires explicit confirmation", () => {
  const input = {
    oldMode: "ON_RECEIPT",
    newMode: "ON_CONSUMPTION",
    hasStockMovements: true,
    confirmed: false,
  } as const;
  assert.throws(
    () => assertCostRecognitionChange(input),
    /future transactions/,
  );
  assert.doesNotThrow(() =>
    assertCostRecognitionChange({ ...input, confirmed: true }),
  );
  assert.doesNotThrow(() =>
    assertCostRecognitionChange({ ...input, hasStockMovements: false }),
  );
  assert.doesNotThrow(() =>
    assertCostRecognitionChange({ ...input, newMode: "ON_RECEIPT" }),
  );
});
