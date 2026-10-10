import assert from "node:assert/strict";
import { test } from "node:test";
import { managerApprovers, submissionTaskEffect } from "./project-effects";

test("final submission decision completes or returns task for rework", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  assert.deepEqual(submissionTaskEffect(true, now), {
    status: "COMPLETED",
    progressPercent: 100,
    completedAt: now,
  });
  assert.deepEqual(submissionTaskEffect(false, now), {
    status: "REWORK",
    completedAt: null,
  });
});
test("manager resolvers combine project managers and isolate stage managers with admin fallback", () => {
  assert.deepEqual(
    managerApprovers("PROJECT_MANAGER", "owner", ["member", "owner"]),
    ["owner", "member"],
  );
  assert.deepEqual(
    managerApprovers("STAGE_MANAGER", "owner", ["member"], "stage-manager"),
    ["stage-manager"],
  );
  assert.equal(managerApprovers("STAGE_MANAGER", "owner", ["member"]), null);
  assert.equal(managerApprovers("PROJECT_MANAGER", null, []), null);
});
