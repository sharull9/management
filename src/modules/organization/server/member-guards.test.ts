import assert from "node:assert/strict";
import test from "node:test";
import { hasPrivilegedMemberRole } from "./member-guards";

test("custom roles remain privileged even when the base role is member", () => {
  assert.equal(hasPrivilegedMemberRole("member", "custom-role"), true);
  assert.equal(hasPrivilegedMemberRole("member", null), false);
  assert.equal(hasPrivilegedMemberRole("admin", null), true);
});
