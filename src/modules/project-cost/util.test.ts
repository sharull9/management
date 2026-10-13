import assert from "node:assert/strict";
import { test } from "node:test";
import { costAmounts } from "@/modules/currency/util";
import { assertCurrencyPrecision, expenseBaseAmount } from "./util";

const projectUsd = {
  baseCurrency: "INR",
  baseDecimals: 2,
  projectCurrency: "USD",
  projectDecimals: 2,
  projectRate: "83.5",
};

test("EUR expense in a USD project with INR base converts through base", () => {
  assert.equal(expenseBaseAmount("100", "90", 2).toFixed(2), "9000.00");
  const posted = costAmounts({
    ...projectUsd,
    originalCurrency: "EUR",
    originalAmount: "100",
    exchangeRate: "90",
  });
  assert.equal(posted.baseAmount.toFixed(2), "9000.00");
  assert.equal(posted.amount.toFixed(2), "107.78");
  assert.equal(posted.originalAmount.toFixed(2), "100.00");
});

test("expense in the project currency keeps its amount exactly when base differs", () => {
  const posted = costAmounts({
    ...projectUsd,
    originalCurrency: "USD",
    originalAmount: "33.33",
    exchangeRate: "83.5",
  });
  assert.equal(posted.amount.toFixed(2), "33.33");
  assert.equal(posted.baseAmount.toFixed(2), "2783.06");
});

test("expense in the base currency is not rescaled by its rate", () => {
  const posted = costAmounts({
    ...projectUsd,
    originalCurrency: "INR",
    originalAmount: "8350",
    exchangeRate: "1",
  });
  assert.equal(posted.baseAmount.toFixed(2), "8350.00");
  assert.equal(posted.amount.toFixed(2), "100.00");
});

test("currency precision is enforced", () => {
  assertCurrencyPrecision("10.50", 2, "USD");
  assert.throws(() => assertCurrencyPrecision("10.5", 0, "JPY"), /JPY/);
});
