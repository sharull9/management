import assert from "node:assert/strict";
import test from "node:test";
import {
  memberInput,
  removeMemberInput,
  removeWorkerInput,
  workerInput,
} from "./schema";

const worker = {
  id: null,
  workerId: "worker",
  startDate: "2026-10-01",
  endDate: "",
  dayRateOverride: "",
  otHourlyRateOverride: "0.0000",
  notes: " notes ",
  confirmOverlap: false,
};
test("members accept nullable roles and typed manager flags", () => {
  assert.deepEqual(
    memberInput.parse({ userId: "member", roleId: null, isManager: true }),
    { userId: "member", roleId: null, isManager: true },
  );
  assert.equal(
    memberInput.safeParse({ userId: "member", roleId: null, isManager: "on" })
      .success,
    false,
  );
  assert.equal(
    memberInput.safeParse({ userId: null, roleId: null, isManager: false })
      .success,
    false,
  );
  assert.equal(removeMemberInput.safeParse({ userId: "" }).success, false);
});
test("worker assignments transform dates and blanks once while preserving zero overrides", () => {
  assert.equal(
    workerInput.safeParse({ ...worker, workerId: null }).success,
    false,
  );
  assert.equal(
    workerInput.parse({ ...worker, dayRateOverride: "   " }).dayRateOverride,
    null,
  );
  const parsed = workerInput.parse(worker);
  assert.equal(parsed.startDate.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(parsed.endDate, null);
  assert.equal(parsed.dayRateOverride, null);
  assert.equal(parsed.otHourlyRateOverride, "0.0000");
  assert.equal(parsed.notes, "notes");
  for (const fields of [
    { startDate: "2026-02-30" },
    { endDate: "2026-09-30" },
    { dayRateOverride: "1.12345" },
    { dayRateOverride: "-1" },
    { confirmOverlap: "on" },
  ])
    assert.equal(
      workerInput.safeParse({ ...worker, ...fields }).success,
      false,
    );
  assert.equal(
    removeWorkerInput.safeParse({ workerId: "worker", id: "" }).success,
    false,
  );
});
