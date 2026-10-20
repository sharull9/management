import assert from "node:assert/strict";
import test from "node:test";
import { dateTimeInputToIso, isoToDateTimeInput } from "./asset-form-utils";

test("asset timestamp inputs use the same UTC calendar dates as allocations", () => {
  const input = "2026-10-01T00:15";
  assert.equal(dateTimeInputToIso(input), "2026-10-01T00:15:00.000Z");
  assert.equal(isoToDateTimeInput(dateTimeInputToIso(input)), input);
  assert.equal(isoToDateTimeInput("2026-10-01T05:45:00+05:30"), input);
});

test("empty or invalid asset timestamps stay empty for schema validation", () => {
  for (const input of ["", "2026-02-30T12:00", "invalid", "2026-10-18T25:00"])
    assert.equal(dateTimeInputToIso(input), "");
  assert.equal(isoToDateTimeInput("invalid"), "");
  assert.equal(isoToDateTimeInput(null), "");
});
