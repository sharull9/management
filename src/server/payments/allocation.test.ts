import assert from "node:assert/strict";
import test from "node:test";
import {
  agingBucket,
  amount,
  runningBalance,
  settlementStatus,
  validateAllocation,
} from "./allocation";

test("allocation protects both balances without floating point loss", () => {
  assert.equal(validateAllocation("0.30", "0.20", "0.10").toFixed(2), "0.10");
  assert.throws(() => validateAllocation("10", "100", "10.01"));
  assert.throws(() => validateAllocation("100", "10", "10.01"));
  assert.throws(() => validateAllocation("100", "100", "0"));
  for (const v of ["-1", "NaN", "Infinity", "0.001"])
    assert.throws(() => amount(v));
  assert.equal(
    amount("9999999999999999.99").sub("0.01").toFixed(2),
    "9999999999999999.98",
  );
});
test("statuses support partial, complete and reversed settlements", () => {
  assert.equal(settlementStatus("100", "0"), "APPROVED");
  assert.equal(settlementStatus("100", "0.01"), "PARTIALLY_PAID");
  assert.equal(settlementStatus("100", "100"), "PAID");
  assert.equal(settlementStatus("0", "0"), "PAID");
  assert.throws(() => settlementStatus("100", "101"));
});
test("aging uses UTC calendar days at every boundary", () => {
  const due = new Date("2026-01-01T23:00:00Z");
  for (const [days, bucket] of [
    [-1, "current"],
    [0, "0–30"],
    [30, "0–30"],
    [31, "31–60"],
    [60, "31–60"],
    [61, "61–90"],
    [90, "61–90"],
    [91, "90+"],
  ] as const)
    assert.equal(
      agingBucket(due, new Date(Date.UTC(2026, 0, 1 + days))),
      bucket,
    );
  assert.equal(agingBucket(null, new Date()), "current");
});
test("statement orders events and allocations do not double count cash", () => {
  const date = new Date("2026-01-01");
  const entries = runningBalance([
    {
      id: "pay",
      date,
      description: "Payment",
      debit: "0",
      credit: "30",
      order: 1,
    },
    {
      id: "bill",
      date,
      description: "Bill",
      debit: "100",
      credit: "0",
      order: 0,
    },
    {
      id: "allocation",
      date,
      description: "Allocation",
      debit: "0",
      credit: "0",
      order: 2,
    },
  ]);
  assert.deepEqual(
    entries.map((e) => e.balance),
    ["100.00", "70.00", "70.00"],
  );
});
