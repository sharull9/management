import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetUsage } from "./budget-usage";

test("fractional budget usage uses decimal precision", () => {
  assert.equal(budgetUsage("3", "1").percent, "33.33");
});
