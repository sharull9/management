import assert from "node:assert/strict";
import test from "node:test";
import {
  allocationActionInput,
  paymentInput,
  requestInput,
  submitRequestInput,
  voidPaymentInput,
} from "./schema";

const common = {
  partyId: "party",
  projectId: null,
  date: "2026-10-11",
  mode: "BANK" as const,
  amount: "9999999999999999.99",
  currency: "INR",
  exchangeRate: "",
};
test("typed payment and request inputs preserve decimal strings and transform dates once", () => {
  const payment = paymentInput.parse({
    ...common,
    direction: "OUTGOING",
    paymentRequestId: null,
    reference: " ref ",
    notes: " note ",
  });
  assert.equal(payment.amount, common.amount);
  assert.equal(payment.date.toISOString(), "2026-10-11T00:00:00.000Z");
  assert.equal(payment.reference, "ref");
  const request = requestInput.parse({
    ...common,
    id: null,
    purpose: "BILL_SETTLEMENT",
    reason: " bills ",
    allocations: [{ documentId: "bill", amount: "0.01" }],
  });
  assert.equal(request.allocations[0].amount, "0.01");
  assert.equal(request.reason, "bills");
  assert.equal(
    paymentInput.safeParse({ ...payment, date: payment.date }).success,
    false,
  );
});
test("typed inputs reject invalid money, dates, modes and missing identifiers", () => {
  const base = {
    ...common,
    direction: "INCOMING",
    paymentRequestId: null,
    reference: "",
    notes: "",
  };
  for (const amount of ["0", "-1", "1.001", "1e2", "NaN", 1.23])
    assert.equal(paymentInput.safeParse({ ...base, amount }).success, false);
  for (const date of ["2026-02-30", "", "2026-10-11T00:00:00Z"])
    assert.equal(paymentInput.safeParse({ ...base, date }).success, false);
  assert.equal(
    paymentInput.safeParse({ ...base, partyId: null }).success,
    false,
  );
  assert.equal(
    paymentInput.safeParse({ ...base, projectId: undefined }).success,
    false,
  );
  assert.equal(
    paymentInput.safeParse({ ...base, mode: "WIRE" }).success,
    false,
  );
});
test("allocation actions require nonempty unique documents and positive decimal amounts", () => {
  assert.equal(
    allocationActionInput.safeParse({ id: "payment", allocations: [] }).success,
    false,
  );
  const line = { documentId: "bill", amount: "1.10" };
  assert.equal(
    allocationActionInput.safeParse({
      id: "payment",
      allocations: [line, line],
    }).success,
    false,
  );
  assert.equal(
    allocationActionInput.safeParse({
      id: "payment",
      allocations: [{ ...line, amount: "0" }],
    }).success,
    false,
  );
  assert.deepEqual(
    allocationActionInput.parse({ id: "payment", allocations: [line] })
      .allocations,
    [line],
  );
  assert.equal(
    requestInput.safeParse({
      ...common,
      id: null,
      purpose: "ADVANCE",
      reason: "reason",
      allocations: [],
    }).success,
    true,
  );
});
test("submit and void schemas validate identifiers and trimmed void reasons", () => {
  assert.equal(submitRequestInput.safeParse({ id: " " }).success, false);
  assert.equal(
    voidPaymentInput.safeParse({ id: "payment", reason: " " }).success,
    false,
  );
  assert.equal(
    voidPaymentInput.safeParse({ id: "payment", reason: "x".repeat(1001) })
      .success,
    false,
  );
  assert.deepEqual(
    voidPaymentInput.parse({ id: "payment", reason: " mistake " }),
    { id: "payment", reason: "mistake" },
  );
});

test("currency and exchange rate inputs", () => {
  const parse = (extra: object) =>
    paymentInput.safeParse({
      ...common,
      direction: "OUTGOING",
      paymentRequestId: null,
      reference: "",
      notes: "",
      ...extra,
    });
  const blank = parse({});
  assert.ok(blank.success);
  assert.equal(blank.data.exchangeRate, null);
  const override = parse({ currency: "USD", exchangeRate: "83.5" });
  assert.ok(override.success);
  assert.equal(override.data.exchangeRate, "83.5");
  for (const bad of ["0", "-1", "abc", "1.12345678901"])
    assert.equal(parse({ exchangeRate: bad }).success, false, bad);
  assert.equal(parse({ currency: "usd" }).success, false);
});
