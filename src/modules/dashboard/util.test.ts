import assert from "node:assert/strict";
import { test } from "node:test";
import { summariseSpend } from "./util";

test("spend sums base amounts and groups project amounts per currency", () => {
  const { base, byCurrency } = summariseSpend([
    { amount: "100.00", baseAmount: "8350.00", projectCurrency: "USD" },
    { amount: "50.50", baseAmount: "4217.00", projectCurrency: "USD" },
    { amount: "1000.00", baseAmount: "1000.00", projectCurrency: "INR" },
  ]);
  assert.equal(base.toFixed(2), "13567.00");
  assert.equal(byCurrency.get("USD")?.toFixed(2), "150.50");
  assert.equal(byCurrency.get("INR")?.toFixed(2), "1000.00");
  assert.equal(byCurrency.size, 2);
});

test("empty spend is zero", () => {
  assert.equal(summariseSpend([]).base.toFixed(2), "0.00");
});
