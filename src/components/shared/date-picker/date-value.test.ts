import assert from "node:assert/strict";
import { test } from "node:test";
import { fromDateValue, toDateValue } from "./date-value";

test("date values round-trip as local calendar dates", () => {
  const date = fromDateValue("2026-03-01");
  assert.ok(date);
  assert.equal(date.getDate(), 1);
  assert.equal(toDateValue(date), "2026-03-01");
});

test("blank and malformed date values are undefined", () => {
  assert.equal(fromDateValue(""), undefined);
  assert.equal(fromDateValue(null), undefined);
  assert.equal(fromDateValue("01-03-2026"), undefined);
});
