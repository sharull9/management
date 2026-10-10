import assert from "node:assert/strict";
import { test } from "node:test";
import { attendanceCost, type PayTerms } from "./costing";

const monthly: PayTerms = {
  payType: "MONTHLY",
  salaryAmount: "30000",
  costDaysPerMonth: "30",
  standardHoursPerDay: "8",
  overtimeMultiplier: "1.5",
};
test("monthly, half day and overtime costs use decimal terms", () => {
  const cost = attendanceCost(monthly, "HALF_DAY", "2");
  assert.equal(cost.dayCost.toFixed(2), "500.00");
  assert.equal(cost.otCost.toFixed(2), "375.00");
  assert.equal(cost.totalCost.toFixed(2), "875.00");
});
test("daily and hourly salaries, zero overrides and absent/leave", () => {
  assert.equal(
    attendanceCost(
      { ...monthly, payType: "DAILY", salaryAmount: "800" },
      "PRESENT",
      "0",
    ).totalCost.toString(),
    "800",
  );
  assert.equal(
    attendanceCost(
      { ...monthly, payType: "HOURLY", salaryAmount: "100" },
      "PRESENT",
      "0",
    ).totalCost.toString(),
    "800",
  );
  for (const status of ["ABSENT", "LEAVE"] as const)
    assert.equal(
      attendanceCost(monthly, status, "0").totalCost.toString(),
      "0",
    );
  assert.equal(
    attendanceCost(
      { ...monthly, dayRateOverride: "0", otHourlyRateOverride: "100" },
      "PRESENT",
      "2",
    ).totalCost.toString(),
    "200",
  );
});
test("fractional rates round only posted day/OT amounts and totals reconcile", () => {
  const cost = attendanceCost(
    { ...monthly, salaryAmount: "100" },
    "HALF_DAY",
    "1",
  );
  assert.equal(cost.dayCost.toFixed(2), "1.67");
  assert.equal(cost.otCost.toFixed(2), "0.63");
  assert.equal(cost.totalCost.toFixed(2), "2.30");
  assert.throws(() =>
    attendanceCost({ ...monthly, standardHoursPerDay: "0" }, "PRESENT", "0"),
  );
});
