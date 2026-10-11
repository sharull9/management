import assert from "node:assert/strict";
import { test } from "node:test";
import {
  designationInput,
  saveWorkerInput,
  workforceFiltersInput,
} from "./schema";

const worker = {
  id: null,
  name: " Worker ",
  phone: "",
  designationId: null,
  payType: "MONTHLY",
  salaryAmount: "123.45",
  costDaysPerMonth: "30",
  standardHoursPerDay: "8",
  overtimeMultiplier: "1.5",
  joinDate: "",
  active: false,
};
test("worker form preserves decimal strings and explicit active state, normalizes blank optional fields", () => {
  const parsed = saveWorkerInput.parse(worker);
  assert.equal(parsed.name, "Worker");
  assert.equal(parsed.phone, null);
  assert.equal(parsed.joinDate, null);
  assert.equal(parsed.active, false);
  assert.equal(parsed.salaryAmount, "123.45");
  for (const change of [
    { costDaysPerMonth: "0" },
    { standardHoursPerDay: "bad" },
    { salaryAmount: "-1" },
    { joinDate: "2026-02-30" },
  ])
    assert.equal(
      saveWorkerInput.safeParse({ ...worker, ...change }).success,
      false,
    );
});
test("designation deletion requires an id but no name; availability requires ordered dates", () => {
  assert.deepEqual(
    designationInput.parse({ operation: "DELETE", id: "designation" }),
    { operation: "DELETE", id: "designation" },
  );
  assert.equal(
    designationInput.safeParse({ operation: "DELETE", id: null }).success,
    false,
  );
  assert.equal(
    designationInput.safeParse({ operation: "SAVE", id: null, name: " " })
      .success,
    false,
  );
  assert.equal(
    workforceFiltersInput.safeParse({
      search: "",
      workerId: null,
      from: "2026-10-12",
      to: "2026-10-11",
    }).success,
    false,
  );
});
