import assert from "node:assert/strict";
import { test } from "node:test";
import { attendanceInput } from "./schema";

const row = {
  workerId: "worker",
  status: "HALF_DAY",
  hoursWorked: "4",
  overtimeHours: "1.2500",
  remove: false,
};
test("attendance parses typed rows without losing overtime precision or removal flags", () => {
  const parsed = attendanceInput.parse({
    date: "2026-10-11",
    rows: [row, { ...row, workerId: "inactive", remove: true }],
  });
  assert.equal(parsed.date.toISOString(), "2026-10-11T00:00:00.000Z");
  assert.equal(parsed.rows[0].overtimeHours, "1.2500");
  assert.equal(parsed.rows[1].remove, true);
});
test("attendance rejects duplicate workers, invalid dates, statuses and negative overtime", () => {
  for (const input of [
    { date: "2026-02-30", rows: [row] },
    { date: "2026-10-11", rows: [row, row] },
    { date: "2026-10-11", rows: [{ ...row, status: "INVALID" }] },
    { date: "2026-10-11", rows: [{ ...row, overtimeHours: "-1" }] },
  ])
    assert.equal(attendanceInput.safeParse(input).success, false);
});
