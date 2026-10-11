import assert from "node:assert/strict";
import test from "node:test";
import { credentials } from "./schema";

test("setup credentials normalize identity and require a strong initial password", () => {
  const input = {
    name: " Admin ",
    email: "ADMIN@example.com",
    password: "long-password",
  };
  assert.deepEqual(credentials.parse(input), {
    ...input,
    name: "Admin",
    email: "admin@example.com",
  });
  assert.equal(
    credentials.safeParse({ ...input, password: "short" }).success,
    false,
  );
  assert.equal(
    credentials.safeParse({ ...input, password: "x".repeat(129) }).success,
    false,
  );
});
