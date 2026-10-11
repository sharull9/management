import assert from "node:assert/strict";
import test from "node:test";
import {
  credentials,
  orgInput,
  recordIdInput,
  saveMemberInput,
  saveRoleInput,
  saveSeriesInput,
} from "./schema";

const organization = {
  id: null,
  tenantId: "tenant",
  name: " Company ",
  slug: "company",
  legalName: "  ",
  baseCurrency: "INR",
  countryId: null,
  stateId: null,
  cityId: null,
  addressLine1: " Street ",
  addressLine2: "",
  postalCode: " 123 ",
};
test("organization typed input preserves trimmed optional FormData semantics", () => {
  const parsed = orgInput.parse(organization);
  assert.equal(parsed.name, "Company");
  assert.equal(parsed.legalName, null);
  assert.equal(parsed.addressLine1, "Street");
  assert.equal(parsed.addressLine2, null);
  assert.equal(parsed.postalCode, "123");
  assert.equal(parsed.countryId, null);
  assert.equal(
    orgInput.parse({ ...organization, countryId: " ", stateId: " state " })
      .stateId,
    "state",
  );
  assert.equal(
    orgInput.safeParse({ ...organization, slug: "admin" }).success,
    false,
  );
  assert.equal(
    orgInput.safeParse({ ...organization, baseCurrency: "inr" }).success,
    false,
  );
});
test("numbering accepts numbers and rejects cleared, fractional and out-of-range counters", () => {
  const series = { type: "PROJECT", prefix: "PRJ-", padding: 4, nextNumber: 1 };
  assert.deepEqual(saveSeriesInput.parse(series), series);
  for (const value of [null, "4", 0, 13, 1.5])
    assert.equal(
      saveSeriesInput.safeParse({ ...series, padding: value }).success,
      false,
    );
  for (const value of [null, "1", 0, 2147483647, 1.5])
    assert.equal(
      saveSeriesInput.safeParse({ ...series, nextNumber: value }).success,
      false,
    );
});
test("member access preserves existing-account provisioning and validates role choices", () => {
  const member = {
    email: "USER@example.com",
    name: "",
    password: "",
    role: "member",
    roleId: null,
  };
  assert.equal(saveMemberInput.parse(member).email, "user@example.com");
  assert.equal(saveMemberInput.parse({ ...member, roleId: " " }).roleId, null);
  assert.equal(
    saveMemberInput.safeParse({ ...member, role: "superadmin" }).success,
    false,
  );
  assert.equal(
    saveMemberInput.safeParse({ ...member, existingEmail: "invalid" }).success,
    false,
  );
  assert.equal(credentials.safeParse(member).success, false);
  assert.equal(
    credentials.safeParse({
      name: "New user",
      email: member.email,
      password: "long-password",
    }).success,
    true,
  );
});
test("role arrays reject unknown permissions and typed deletes require an ID", () => {
  const role = {
    id: null,
    name: "Read only",
    description: "",
    permissions: ["members.manage"],
  };
  assert.deepEqual(saveRoleInput.parse(role), role);
  assert.equal(
    saveRoleInput.safeParse({ ...role, permissions: ["unknown"] }).success,
    false,
  );
  assert.equal(recordIdInput.safeParse({ id: "" }).success, false);
  assert.deepEqual(recordIdInput.parse({ id: "member" }), { id: "member" });
});
