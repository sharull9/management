import assert from "node:assert/strict";
import test from "node:test";
import { projectCurrencyChangeError } from "./currency-guard";

test("an unchanged currency is always allowed", () => {
  assert.equal(
    projectCurrencyChangeError({ current: "INR", next: "INR", costEntries: 9 }),
    null,
  );
});
test("a project without cost entries may change currency", () => {
  assert.equal(
    projectCurrencyChangeError({ current: "INR", next: "USD", costEntries: 0 }),
    null,
  );
});
test("a project with cost entries cannot change currency", () => {
  assert.match(
    projectCurrencyChangeError({
      current: "INR",
      next: "USD",
      costEntries: 3,
    }) ?? "",
    /INR to USD.*3 cost entries/,
  );
  assert.match(
    projectCurrencyChangeError({
      current: "INR",
      next: "USD",
      costEntries: 1,
    }) ?? "",
    /1 cost entry;/,
  );
});
