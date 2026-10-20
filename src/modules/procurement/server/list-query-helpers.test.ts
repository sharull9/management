import assert from "node:assert/strict";
import test from "node:test";
import {
  procurementOrderBy,
  procurementSearchWhere,
  procurementSortKeys,
} from "./list-query-helpers";

test("procurement list search scopes document code and accessible project labels", () => {
  assert.deepEqual(procurementSearchWhere(" bolt ", "requests"), {
    OR: [
      { code: { contains: "bolt", mode: "insensitive" } },
      { project: { name: { contains: "bolt", mode: "insensitive" } } },
    ],
  });
  assert.equal(procurementSearchWhere("", "requests").OR, undefined);
});

test("transfer search also matches destination; advertised sort keys are implemented", () => {
  assert.equal(procurementSearchWhere("yard", "transfers").OR?.length, 3);
  assert.deepEqual(procurementSortKeys, ["code", "project", "status", "date"]);
  assert.deepEqual(procurementOrderBy("date", "asc"), { createdAt: "asc" });
  assert.deepEqual(procurementOrderBy("status", "desc"), { status: "desc" });
});
