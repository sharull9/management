import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalAmount,
  sourceFingerprint,
  utcDay,
} from "./posting-normalize";

test("source normalization uses UTC calendar days and canonical decimals", () => {
  assert.equal(
    utcDay("2026-01-02T23:30:00-05:00").toISOString(),
    "2026-01-03T00:00:00.000Z",
  );
  assert.equal(canonicalAmount("12.5000"), "12.5");
  assert.equal(
    sourceFingerprint({ debit: canonicalAmount("1.00") }),
    sourceFingerprint({ debit: canonicalAmount("1") }),
  );
});
