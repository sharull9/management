import assert from "node:assert/strict";
import test from "node:test";
import {
  filterSteps,
  moneyCents,
  nextStep,
  type StepRule,
  snapshotSteps,
} from "./logic";

test("thresholds compare decimal money exactly, including large values", () => {
  const steps: StepRule[] = [
    {
      sequence: 2,
      name: "Finance",
      approverType: "ROLE",
      minAmount: "900719925474099.21",
    },
    { sequence: 1, name: "Manager", approverType: "PROJECT_MANAGER" },
  ];
  assert.deepEqual(
    filterSteps(steps, "900719925474099.20").map((s) => s.name),
    ["Manager"],
  );
  assert.equal(filterSteps(steps, "900719925474099.21").length, 2);
  assert.equal(moneyCents("1.2"), 120n);
  assert.throws(() => moneyCents("-1"));
  assert.throws(() => moneyCents("1.001"));
});
test("snapshots are sequential and independent of source policy", () => {
  const steps: StepRule[] = [
    { sequence: 9, name: "Second", approverType: "USER", userId: "b" },
    { sequence: 3, name: "First", approverType: "USER", userId: "a" },
  ];
  const snapshot = snapshotSteps(steps);
  steps[1].name = "Changed";
  assert.deepEqual(
    snapshot.map((s) => [s.name, s.sequence, s.status]),
    [
      ["First", 1, "PENDING"],
      ["Second", 2, "WAITING"],
    ],
  );
});
test("missing policies and fully filtered policies produce a manager fallback", () => {
  assert.equal(snapshotSteps([])[0].approverType, "PROJECT_MANAGER");
  assert.equal(
    snapshotSteps(
      [
        {
          sequence: 1,
          name: "High value",
          approverType: "USER",
          minAmount: "100",
        },
      ],
      "99.99",
    )[0].status,
    "PENDING",
  );
});
test("advances only to the next waiting step", () => {
  const steps = [
    { sequence: 3, status: "WAITING" },
    { sequence: 1, status: "APPROVED" },
    { sequence: 2, status: "WAITING" },
  ];
  assert.equal(nextStep(steps, 1)?.sequence, 2);
  assert.equal(nextStep(steps, 3), null);
});
