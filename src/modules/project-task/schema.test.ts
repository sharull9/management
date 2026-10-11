import assert from "node:assert/strict";
import { test } from "node:test";
import {
  saveTaskInput,
  taskOperationInput,
  taskSubmissionInput,
} from "./schema";

const task = {
  id: null,
  title: " Task ",
  description: "",
  stageId: null,
  priority: "NORMAL",
  status: "TODO",
  progressPercent: 0,
  plannedStart: "",
  dueDate: "",
  estimatedHours: "",
};
test("task form normalizes blank dates/hours and validates date order and progress", () => {
  const parsed = saveTaskInput.parse(task);
  assert.equal(parsed.title, "Task");
  assert.equal(parsed.plannedStart, null);
  assert.equal(parsed.dueDate, null);
  assert.equal(parsed.estimatedHours, null);
  for (const change of [
    { dueDate: "2026-02-30" },
    { plannedStart: "2026-10-12", dueDate: "2026-10-11" },
    { progressPercent: null },
    { progressPercent: 101 },
  ])
    assert.equal(
      saveTaskInput.safeParse({ ...task, ...change }).success,
      false,
    );
});
test("batch assignment requires distinct workers and ordered optional dates", () => {
  const input = {
    operation: "ASSIGN",
    workerIds: ["worker-1", "worker-2"],
    startDate: "2026-10-11",
    endDate: "",
  };
  const parsed = taskOperationInput.parse(input);
  assert.equal(parsed.operation, "ASSIGN");
  if (parsed.operation === "ASSIGN") {
    assert.deepEqual(parsed.workerIds, input.workerIds);
    assert.equal(parsed.endDate, null);
    assert.equal(parsed.startDate?.toISOString(), "2026-10-11T00:00:00.000Z");
  }
  for (const change of [
    { workerIds: [] },
    { workerIds: ["same", "same"] },
    { endDate: "2026-10-10" },
  ])
    assert.equal(
      taskOperationInput.safeParse({ ...input, ...change }).success,
      false,
    );
});
test("delay and upload submission preserve approval payload parsing", () => {
  const delay = taskOperationInput.parse({
    operation: "DELAY",
    reason: " Reason ",
    proposedDueDate: "2026-10-12",
  });
  assert.equal(delay.operation, "DELAY");
  if (delay.operation === "DELAY") {
    assert.equal(delay.reason, "Reason");
    assert.equal(
      delay.proposedDueDate.toISOString(),
      "2026-10-12T00:00:00.000Z",
    );
  }
  assert.deepEqual(
    taskSubmissionInput.parse({
      note: " Done ",
      progressPercent: "65",
      onBehalfOfWorkerId: null,
    }),
    { note: "Done", progressPercent: 65, onBehalfOfWorkerId: null },
  );
  assert.equal(
    taskOperationInput.safeParse({
      operation: "DELAY",
      reason: "",
      proposedDueDate: "2026-10-12",
    }).success,
    false,
  );
});
