import assert from "node:assert/strict";
import { test } from "node:test";
import { findNavLocation, isNavActive } from "./app-nav";

test("dashboard is active only on the organization root", () => {
  assert.equal(isNavActive("/acme", "/acme", ""), true);
  assert.equal(isNavActive("/acme/projects", "/acme", ""), false);
});

test("nested pages resolve to their navigation group", () => {
  const location = findNavLocation("/acme/procurement/bills/new", "/acme");
  assert.equal(location?.group.title, "Procurement");
  assert.equal(location?.link.title, "Vendor bills");
});
