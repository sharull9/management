import assert from "node:assert/strict";
import test from "node:test";
import { journalInput, reportFiltersInput } from "./schema";

const validJournal = {
  date: "2026-10-18",
  description: "Opening entry",
  lines: [
    {
      accountId: "cash",
      description: "Cash",
      debit: "10.00",
      credit: "0",
      projectId: null,
      partyId: null,
    },
    {
      accountId: "equity",
      description: "Equity",
      debit: "0",
      credit: "10.00",
      projectId: null,
      partyId: null,
    },
  ],
};

test("journal inputs keep dates as strings and bound decimal values", () => {
  const parsed = journalInput.parse(validJournal);
  assert.equal(parsed.date, "2026-10-18");
  assert.equal(typeof parsed.date, "string");
  assert.equal(
    journalInput.safeParse({
      ...validJournal,
      lines: [
        { ...validJournal.lines[0], debit: "1.001" },
        validJournal.lines[1],
      ],
    }).success,
    false,
  );
  assert.equal(
    journalInput.safeParse({
      ...validJournal,
      lines: [
        { ...validJournal.lines[0], debit: "10000000000000000" },
        validJournal.lines[1],
      ],
    }).success,
    false,
  );
  assert.equal(
    journalInput.safeParse({ ...validJournal, date: "2026-02-30" }).success,
    false,
  );
});

test("report date ranges must be ordered", () => {
  assert.equal(
    reportFiltersInput.safeParse({ from: "2026-01-01", to: "2026-12-31" })
      .success,
    true,
  );
  assert.equal(
    reportFiltersInput.safeParse({ from: "2026-12-31", to: "2026-01-01" })
      .success,
    false,
  );
});
