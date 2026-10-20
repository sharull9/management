import assert from "node:assert/strict";
import test from "node:test";
import {
  canManageProjectApprovers,
  canViewCompensation,
} from "../access-policy";

const access = (isAdmin: boolean, permissions: string[]) =>
  ({ isAdmin, permissions: new Set(permissions) }) as Parameters<
    typeof canManageProjectApprovers
  >[0];

test("project approver authority requires admin or explicit project management", () => {
  assert.equal(
    canManageProjectApprovers(access(false, ["project.edit"])),
    false,
  );
  assert.equal(
    canManageProjectApprovers(access(false, ["project.manage"])),
    true,
  );
  assert.equal(
    canManageProjectApprovers(access(false, ["project.settings.manage"])),
    true,
  );
});

test("compensation visibility is separate from ordinary project editing", () => {
  assert.equal(canViewCompensation(access(false, ["project.edit"])), false);
  assert.equal(canViewCompensation(access(false, ["cost.view"])), true);
  assert.equal(canViewCompensation(access(false, ["workforce.manage"])), true);
});
