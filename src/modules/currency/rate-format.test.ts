import assert from "node:assert/strict";
import test from "node:test";
import { describeRate, formatRate } from "./rate-format";

test("rates are shown with ten decimals", () => {
  assert.equal(formatRate("83.5"), "83.5000000000");
  assert.equal(formatRate("1"), "1.0000000000");
  assert.equal(formatRate("0.0123456789"), "0.0123456789");
});
test("a rate reads as base units per one foreign unit", () => {
  assert.equal(describeRate("USD", "INR", "83.5"), "1 USD = 83.5000000000 INR");
});
