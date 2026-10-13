import assert from "node:assert/strict";
import test from "node:test";
import {
  addCurrencyInput,
  deleteExchangeRateInput,
  exchangeRateInput,
  tenantCurrencyInput,
} from "./schema";

const rateInput = { currencyCode: "USD", rateDate: "2026-10-13", rate: "83.5" };

test("currency codes are three uppercase letters", () => {
  assert.equal(
    addCurrencyInput.safeParse({ currencyCode: "USD" }).success,
    true,
  );
  for (const currencyCode of ["usd", "US", "USDX", ""])
    assert.equal(addCurrencyInput.safeParse({ currencyCode }).success, false);
  assert.equal(
    tenantCurrencyInput.safeParse({ currencyCode: "EUR", enabled: "yes" })
      .success,
    false,
  );
});
test("exchange rates must be positive with at most 10 decimals", () => {
  assert.equal(exchangeRateInput.safeParse(rateInput).success, true);
  assert.equal(
    exchangeRateInput.safeParse({ ...rateInput, rate: "0.0000000001" }).success,
    true,
  );
  for (const rate of ["0", "0.0", "-1", "1.12345678901", "abc", ""])
    assert.equal(
      exchangeRateInput.safeParse({ ...rateInput, rate }).success,
      false,
      rate,
    );
});
test("exchange rate dates are calendar dates and ids are optional", () => {
  assert.equal(
    exchangeRateInput.safeParse({ ...rateInput, rateDate: "2026-02-30" })
      .success,
    false,
  );
  assert.equal(
    exchangeRateInput.safeParse({ ...rateInput, id: "rate_1" }).success,
    true,
  );
  assert.equal(deleteExchangeRateInput.safeParse({}).success, false);
});
