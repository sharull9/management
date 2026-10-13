import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPositiveRate,
  assertSameCurrency,
  assertStorableCurrency,
  type CostAmountsInput,
  costAmounts,
  fromBase,
  realisedFx,
  roundMoney,
  toBase,
} from "./util";

const base: CostAmountsInput = {
  originalCurrency: "INR",
  originalAmount: "1000.00",
  exchangeRate: "1",
  baseCurrency: "INR",
  baseDecimals: 2,
  projectCurrency: "INR",
  projectDecimals: 2,
  projectRate: "1",
};
const str = (v: { toString(): string }) => v.toString();

test("roundMoney rounds half away from zero at the given decimals", () => {
  assert.equal(str(roundMoney("1.005", 2)), "1.01");
  assert.equal(str(roundMoney("-1.005", 2)), "-1.01");
  assert.equal(str(roundMoney("2.5", 0)), "3");
  assert.equal(str(roundMoney("-2.5", 0)), "-3");
  assert.equal(str(roundMoney("1.2345", 3)), "1.235");
  assert.equal(str(roundMoney("1.2344", 3)), "1.234");
});

test("toBase and fromBase use base units per 1 foreign unit", () => {
  assert.equal(str(toBase("100", "83.1234567890", 2)), "8312.35");
  assert.equal(str(toBase("-100", "83.1234567890", 2)), "-8312.35");
  assert.equal(str(fromBase("8312.35", "83.123456789", 2)), "100");
  assert.equal(str(toBase("1000", "0.0067", 0)), "7");
  assert.equal(str(toBase("10.005", "1", 2)), "10.01");
});

test("rates must be positive", () => {
  assert.throws(() => assertPositiveRate("0"), /greater than zero/);
  assert.throws(() => toBase("1", "-2", 2), /greater than zero/);
  assert.throws(() => fromBase("1", "0", 2), /greater than zero/);
  assert.equal(str(assertPositiveRate("0.0000000001")), "1e-10");
});

test("same currency everywhere keeps the amount exactly", () => {
  const r = costAmounts(base);
  assert.equal(str(r.originalAmount), "1000");
  assert.equal(str(r.baseAmount), "1000");
  assert.equal(str(r.amount), "1000");
});

test("base currency ignores a supplied rate", () => {
  const r = costAmounts({ ...base, exchangeRate: "99" });
  assert.equal(str(r.baseAmount), "1000");
  assert.equal(str(r.amount), "1000");
});

test("foreign original in a base-currency project converts to base", () => {
  const r = costAmounts({
    ...base,
    originalCurrency: "USD",
    originalAmount: "100",
    exchangeRate: "83.25",
  });
  assert.equal(str(r.originalAmount), "100");
  assert.equal(str(r.baseAmount), "8325");
  assert.equal(str(r.amount), "8325");
});

test("project currency equal to original keeps the original exactly", () => {
  const r = costAmounts({
    ...base,
    originalCurrency: "USD",
    originalAmount: "123.45",
    exchangeRate: "83.3333333333",
    projectCurrency: "USD",
    projectRate: "83.3333333333",
  });
  assert.equal(str(r.amount), "123.45");
  assert.equal(str(r.baseAmount), "10287.5");
});

test("project currency differs from original and base", () => {
  // EUR cost, INR base, USD project. 1 EUR = 90 INR, 1 USD = 80 INR.
  const r = costAmounts({
    ...base,
    originalCurrency: "EUR",
    originalAmount: "100",
    exchangeRate: "90",
    projectCurrency: "USD",
    projectRate: "80",
  });
  assert.equal(str(r.baseAmount), "9000");
  assert.equal(str(r.amount), "112.5");
});

test("base differs from project but original is base: converts to project", () => {
  const r = costAmounts({
    ...base,
    originalAmount: "8000",
    projectCurrency: "USD",
    projectRate: "80",
  });
  assert.equal(str(r.baseAmount), "8000");
  assert.equal(str(r.amount), "100");
});

test("project currency decimals round the project amount", () => {
  const jpy = costAmounts({
    ...base,
    originalAmount: "1000",
    projectCurrency: "JPY",
    projectDecimals: 0,
    projectRate: "0.55",
  });
  assert.equal(str(jpy.amount), "1818");
  const kwd = costAmounts({
    ...base,
    originalAmount: "1000",
    projectCurrency: "KWD",
    projectDecimals: 3,
    projectRate: "271.3",
  });
  assert.equal(str(kwd.amount), "3.686");
});

test("base decimals round the base amount", () => {
  const r = costAmounts({
    ...base,
    originalCurrency: "USD",
    originalAmount: "10",
    exchangeRate: "151.55",
    baseCurrency: "JPY",
    baseDecimals: 0,
    projectCurrency: "JPY",
    projectDecimals: 0,
  });
  assert.equal(str(r.baseAmount), "1516");
  assert.equal(str(r.amount), "1516");
});

test("negative amounts keep their sign and round symmetrically", () => {
  const r = costAmounts({
    ...base,
    originalCurrency: "USD",
    originalAmount: "-100.005",
    exchangeRate: "83.3333",
  });
  assert.equal(str(r.originalAmount), "-100.005");
  assert.equal(str(r.baseAmount), "-8333.75");
  assert.equal(str(r.amount), "-8333.75");
  const positive = costAmounts({
    ...base,
    originalCurrency: "USD",
    originalAmount: "100.005",
    exchangeRate: "83.3333",
  });
  assert.equal(str(positive.baseAmount), "8333.75");
});

test("a missing project rate is rejected when it is needed", () => {
  assert.throws(
    () =>
      costAmounts({
        ...base,
        originalAmount: "10",
        projectCurrency: "USD",
        projectRate: "0",
      }),
    /Project exchange rate must be greater than zero/,
  );
});

test("realised FX: payable paid at a worse rate is a loss", () => {
  const fx = realisedFx({
    amount: "100",
    paymentRate: "84",
    documentRate: "83",
    baseDecimals: 2,
    direction: "OUTGOING",
  });
  assert.equal(str(fx.baseAmount), "8400");
  assert.equal(str(fx.documentBaseAmount), "8300");
  assert.equal(str(fx.fxDifference), "100");
  assert.equal(fx.outcome, "LOSS");
});

test("realised FX: receivable collected at a better rate is a gain", () => {
  const fx = realisedFx({
    amount: "100",
    paymentRate: "84",
    documentRate: "83",
    baseDecimals: 2,
    direction: "INCOMING",
  });
  assert.equal(str(fx.fxDifference), "100");
  assert.equal(fx.outcome, "GAIN");
});

test("realised FX: lower payment rate flips outcomes and equal rates are none", () => {
  const payable = realisedFx({
    amount: "100",
    paymentRate: "82",
    documentRate: "83",
    baseDecimals: 2,
    direction: "OUTGOING",
  });
  assert.equal(str(payable.fxDifference), "-100");
  assert.equal(payable.outcome, "GAIN");
  const receivable = realisedFx({
    amount: "100",
    paymentRate: "82",
    documentRate: "83",
    baseDecimals: 2,
    direction: "INCOMING",
  });
  assert.equal(receivable.outcome, "LOSS");
  const same = realisedFx({
    amount: "100",
    paymentRate: "83",
    documentRate: "83",
    baseDecimals: 2,
    direction: "OUTGOING",
  });
  assert.equal(str(same.fxDifference), "0");
  assert.equal(same.outcome, "NONE");
});

test("allocation requires matching currencies", () => {
  assertSameCurrency("INR", "INR");
  assert.throws(
    () => assertSameCurrency("USD", "INR", "Payment PAY-1"),
    /Payment PAY-1 is in USD but the document is in INR/,
  );
});

test("currencies with more than two decimals are rejected until columns are widened", () => {
  assert.doesNotThrow(() => assertStorableCurrency("JPY", 0));
  assert.doesNotThrow(() => assertStorableCurrency("INR", 2));
  assert.throws(() => assertStorableCurrency("KWD", 3), /KWD uses 3 decimal/);
});
