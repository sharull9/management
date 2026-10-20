import assert from "node:assert/strict";
import test from "node:test";
import { Decimal } from "@/core/decimal";
import {
  accountBalance,
  allocateBaseAmounts,
  reverseLines,
  validateJournalLines,
} from "./util";

test("validates balanced journals with exact decimal totals", () => {
  const totals = validateJournalLines([
    { debit: "12.30", credit: "0" },
    { debit: "0", credit: "12.30" },
  ]);
  assert.equal(totals.debit.toFixed(2), "12.30");
  assert.equal(totals.credit.toFixed(2), "12.30");
});

test("rejects unbalanced, zero, both-sided, negative, and over-precision lines", () => {
  assert.throws(
    () =>
      validateJournalLines([
        { debit: "1", credit: "0" },
        { debit: "0", credit: "2" },
      ]),
    /balance/,
  );
  assert.throws(
    () =>
      validateJournalLines([
        { debit: "0", credit: "0" },
        { debit: "1", credit: "0" },
      ]),
    /exactly one/,
  );
  assert.throws(
    () =>
      validateJournalLines([
        { debit: "1", credit: "1" },
        { debit: "0", credit: "2" },
      ]),
    /exactly one/,
  );
  assert.throws(
    () =>
      validateJournalLines([
        { debit: "-1", credit: "0" },
        { debit: "0", credit: "-1" },
      ]),
    /negative/,
  );
  assert.throws(
    () =>
      validateJournalLines([
        { debit: "1.001", credit: "0" },
        { debit: "0", credit: "1.001" },
      ]),
    /decimal places/,
  );
});

test("uses zero-decimal precision for JPY journals", () => {
  const totals = validateJournalLines(
    [
      { debit: "125", credit: "0" },
      { debit: "0", credit: "125" },
    ],
    0,
  );
  assert.equal(totals.debit.toFixed(0), "125");
  assert.throws(
    () =>
      validateJournalLines(
        [
          { debit: "1.1", credit: "0" },
          { debit: "0", credit: "1.1" },
        ],
        0,
      ),
    /decimal places/,
  );
});

test("returns normal debit or credit account balances", () => {
  assert.equal(accountBalance("ASSET", "15", "4").toString(), "11");
  assert.equal(accountBalance("EXPENSE", "15", "4").toString(), "11");
  assert.equal(accountBalance("LIABILITY", "4", "15").toString(), "11");
  assert.equal(accountBalance("EQUITY", "4", "15").toString(), "11");
  assert.equal(accountBalance("INCOME", "4", "15").toString(), "11");
});

test("allocates largest remainders exactly, including tiny shares", () => {
  assert.deepEqual(
    allocateBaseAmounts("0.02", ["1", "1", "1"]).map((n) => n.toFixed(2)),
    ["0.01", "0.01", "0.00"],
  );
  assert.deepEqual(
    allocateBaseAmounts("1.00", ["1", "2", "3"]).map((n) => n.toFixed(2)),
    ["0.17", "0.33", "0.50"],
  );
  const rounded = allocateBaseAmounts("1", ["1", "1", "1"], 0);
  assert.equal(
    rounded.reduce((sum, n) => sum.add(n), new Decimal(0)).toFixed(0),
    "1",
  );
  assert.deepEqual(
    allocateBaseAmounts("0", ["0", "0"]).map((n) => n.toFixed(2)),
    ["0.00", "0.00"],
  );
});

test("rejects negative allocations and positive totals without positive weights", () => {
  assert.throws(() => allocateBaseAmounts("-1", ["1"]), /non-negative/);
  assert.throws(() => allocateBaseAmounts("1", ["0", "0"]), /positive weights/);
});

test("reverses debit, credit, dimensions, and tax-base snapshots exactly", () => {
  const lines = [
    {
      accountId: "a",
      debit: "42.50",
      credit: "0",
      projectId: "p",
      partyId: null,
      taxComponentId: "t",
      taxName: "VAT",
      taxRate: "18.0000",
      taxBaseAmount: new Decimal("42.50"),
    },
  ];
  const reversed = reverseLines(lines);
  assert.equal(reversed[0]?.debit, "0");
  assert.equal(reversed[0]?.credit, "42.50");
  assert.equal(reversed[0]?.projectId, "p");
  assert.equal(reversed[0]?.taxComponentId, "t");
  assert.equal(reversed[0]?.taxBaseAmount?.toString(), "-42.5");
});
