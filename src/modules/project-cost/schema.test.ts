import assert from "node:assert/strict";
import { test } from "node:test";
import { costRecognitionInput, createExpenseInput } from "./schema";

test("cost recognition accepts only explicit enum modes and boolean acknowledgement", () => {
  assert.deepEqual(
    costRecognitionInput.parse({
      materialCostRecognition: "ON_CONSUMPTION",
      confirmCostRecognitionChange: false,
    }),
    {
      materialCostRecognition: "ON_CONSUMPTION",
      confirmCostRecognitionChange: false,
    },
  );
  assert.equal(
    costRecognitionInput.safeParse({
      materialCostRecognition: "ON_RECEIPT",
      confirmCostRecognitionChange: "on",
    }).success,
    false,
  );
  assert.equal(
    costRecognitionInput.safeParse({
      materialCostRecognition: "INVALID",
      confirmCostRecognitionChange: true,
    }).success,
    false,
  );
});
test("expense preserves approval amount, nullable references and UTC date, rejects malformed amounts", () => {
  const input = {
    date: "2026-10-11",
    costType: "OTHER",
    currency: "EUR",
    exchangeRate: "90.5",
    amount: "123.45",
    description: " Expense ",
    stageId: null,
    taskId: null,
    partyId: null,
  };
  const parsed = createExpenseInput.parse(input);
  assert.equal(parsed.amount, "123.45");
  assert.equal(parsed.description, "Expense");
  assert.equal(parsed.date.toISOString(), "2026-10-11T00:00:00.000Z");
  assert.equal(parsed.stageId, null);
  assert.equal(parsed.currency, "EUR");
  assert.equal(parsed.exchangeRate, "90.5");
  assert.equal(
    createExpenseInput.parse({ ...input, exchangeRate: "" }).exchangeRate,
    null,
  );
  for (const change of [
    { amount: "bad" },
    { amount: "0.00" },
    { amount: "-1" },
    { date: "2026-02-30" },
    { costType: "INVALID" },
    { currency: "eur" },
    { exchangeRate: "0" },
    { exchangeRate: "-2" },
  ])
    assert.equal(
      createExpenseInput.safeParse({ ...input, ...change }).success,
      false,
    );
});
