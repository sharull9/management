import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMoney } from "./format";

test("formats money with Indian grouping and two decimals", () => {
  assert.equal(formatMoney("630725.9", "INR"), "₹6,30,725.90");
  assert.equal(formatMoney({ toString: () => "1200" }, "USD"), "$1,200.00");
});

test("unknown currency codes still format the number", () => {
  assert.equal(formatMoney(1500, "NOTACODE"), "1,500.00");
});
