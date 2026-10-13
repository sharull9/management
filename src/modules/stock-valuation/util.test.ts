import assert from "node:assert/strict";
import test from "node:test";
import { costAmounts } from "@/modules/currency/util";
import { movingAverage, receiptValuation } from "./util";

test("USD receipt is valued in base at the GRN rate, not the PO rate", () => {
  // PO raised at 83, received at 84: 10 bags x 100 USD x 84 = 84,000 INR.
  const valuation = receiptValuation({
    acceptedQty: "10",
    netRate: "100",
    stockQty: "10",
    exchangeRate: "84",
    baseDecimals: 2,
  });
  assert.equal(valuation.documentValue.toFixed(2), "1000.00");
  assert.equal(valuation.baseValue.toFixed(2), "84000.00");
  assert.equal(valuation.unitCost.toFixed(8), "8400.00000000");
});

test("receipt base value is converted once and rounded to base decimals", () => {
  const valuation = receiptValuation({
    acceptedQty: "3",
    netRate: "10.3333",
    stockQty: "6",
    exchangeRate: "83.456789",
    baseDecimals: 2,
  });
  // 3 x 10.3333 = 30.9999 USD; x 83.456789 = 2587.1521... -> 2587.15 INR.
  assert.equal(valuation.baseValue.toFixed(2), "2587.15");
  assert.equal(valuation.unitCost.toFixed(8), "431.19166667");
});

test("base-currency receipts keep the PO price at rate 1", () => {
  const valuation = receiptValuation({
    acceptedQty: "4",
    netRate: "250.5",
    stockQty: "8",
    exchangeRate: "1",
    baseDecimals: 2,
  });
  assert.equal(valuation.baseValue.toFixed(2), "1002.00");
  assert.equal(valuation.unitCost.toFixed(4), "125.2500");
});

test("receipt valuation rejects a non-positive rate or empty stock quantity", () => {
  const input = {
    acceptedQty: "1",
    netRate: "1",
    stockQty: "1",
    exchangeRate: "1",
    baseDecimals: 2,
  };
  assert.throws(() => receiptValuation({ ...input, exchangeRate: "0" }));
  assert.throws(() => receiptValuation({ ...input, stockQty: "0" }));
});

test("moving average over base receipts mixes receipts at different rates", () => {
  const first = receiptValuation({
    acceptedQty: "10",
    netRate: "100",
    stockQty: "10",
    exchangeRate: "83",
    baseDecimals: 2,
  });
  const second = receiptValuation({
    acceptedQty: "10",
    netRate: "100",
    stockQty: "10",
    exchangeRate: "85",
    baseDecimals: 2,
  });
  const balance = {
    qty: "10",
    value: first.baseValue.toString(),
  };
  const next = movingAverage(balance, { qty: "10", unitCost: second.unitCost });
  assert.equal(next.value.toFixed(2), "168000.00");
  assert.equal(next.avgCost.toFixed(2), "8400.00");
});

test("a transfer between projects of different currencies moves one base value", () => {
  // Source (INR project) loses 12,000 INR base; destination (USD project at 80).
  const base = "12000";
  const source = costAmounts({
    originalCurrency: "INR",
    originalAmount: `-${base}`,
    exchangeRate: "1",
    baseCurrency: "INR",
    baseDecimals: 2,
    projectCurrency: "INR",
    projectDecimals: 2,
    projectRate: "1",
  });
  const destination = costAmounts({
    originalCurrency: "INR",
    originalAmount: base,
    exchangeRate: "1",
    baseCurrency: "INR",
    baseDecimals: 2,
    projectCurrency: "USD",
    projectDecimals: 2,
    projectRate: "80",
  });
  assert.equal(source.baseAmount.toFixed(2), "-12000.00");
  assert.equal(source.amount.toFixed(2), "-12000.00");
  assert.equal(destination.baseAmount.toFixed(2), "12000.00");
  assert.equal(destination.amount.toFixed(2), "150.00");
  assert.equal(
    source.baseAmount.add(destination.baseAmount).toFixed(2),
    "0.00",
  );
});

test("a foreign-currency GRN cost entry keeps document, base and project amounts", () => {
  // USD GRN at 84 into an EUR project (90 INR per EUR), base INR.
  const amounts = costAmounts({
    originalCurrency: "USD",
    originalAmount: "1000",
    exchangeRate: "84",
    baseCurrency: "INR",
    baseDecimals: 2,
    projectCurrency: "EUR",
    projectDecimals: 2,
    projectRate: "90",
  });
  assert.equal(amounts.originalAmount.toFixed(2), "1000.00");
  assert.equal(amounts.baseAmount.toFixed(2), "84000.00");
  assert.equal(amounts.amount.toFixed(2), "933.33");
});
