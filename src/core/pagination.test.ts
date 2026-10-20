import assert from "node:assert/strict";
import test from "node:test";
import { listParams, pageInfo } from "./pagination";

test("list URLs bound page, search and sort input", () => {
  assert.equal(listParams({ page: "-1" }).page, 1);
  assert.equal(listParams({ page: "Infinity" }).skip, 0);
  assert.equal(listParams({ page: "0" }).page, 1);
  assert.equal(listParams({ page: ["3", "4"] }).skip, 50);
  assert.equal(
    listParams({ search: ` ${"x".repeat(200)} ` }).search.length,
    150,
  );
  assert.equal(listParams({ direction: "anything" }).direction, "desc");
  assert.equal(
    listParams({ direction: "INCOMING", sortDirection: "asc" }).direction,
    "asc",
  );
});

test("pagination clamps stale pages after filters reduce the result count", () => {
  assert.deepEqual(pageInfo(26, { page: 99, pageSize: 25 }), {
    page: 2,
    pageSize: 25,
    total: 26,
  });
  assert.equal(pageInfo(0, { page: 99, pageSize: 25 }).page, 1);
});
