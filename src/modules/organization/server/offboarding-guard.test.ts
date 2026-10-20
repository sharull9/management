import assert from "node:assert/strict";
import test from "node:test";
import { assertNoApprovalAssignments } from "./offboarding-guard";

test("offboarding blocks active direct-approver policies", () => {
  assert.throws(
    () => assertNoApprovalAssignments(1, 0),
    /active approval policies/,
  );
});

test("offboarding blocks unresolved steps including future waiting steps", () => {
  assert.throws(
    () => assertNoApprovalAssignments(0, 1),
    /pending approval requests/,
  );
  assert.doesNotThrow(() => assertNoApprovalAssignments(0, 0));
});
