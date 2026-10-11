import assert from "node:assert/strict";
import test from "node:test";
import { enumOptions, toOptions } from "./enum-options";

test("row options preserve IDs, labels and order without mutating rows", () => {
  const rows = Object.freeze([
    Object.freeze({ id: "b", name: "Steel & timber" }),
    Object.freeze({ id: "a", name: "" }),
  ]);
  assert.deepEqual(toOptions(rows), [
    { value: "b", label: "Steel & timber" },
    { value: "a", label: "" },
  ]);
  assert.deepEqual(toOptions([]), []);
});

test("enum options retain enum values and title-case underscore-separated labels", () => {
  assert.deepEqual(
    enumOptions({
      consumption: "ON_CONSUMPTION",
      raw: "RAW_MATERIAL",
      other: "OTHER",
    }),
    [
      { value: "ON_CONSUMPTION", label: "On Consumption" },
      { value: "RAW_MATERIAL", label: "Raw Material" },
      { value: "OTHER", label: "Other" },
    ],
  );
  assert.deepEqual(enumOptions({}), []);
});
