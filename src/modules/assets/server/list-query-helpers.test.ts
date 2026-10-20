import assert from "node:assert/strict";
import test from "node:test";
import {
  assetListWhere,
  assetOrderBy,
  assetSearchWhere,
  assetSortKeys,
  historySearchWhere,
} from "./list-query-helpers";

test("asset list query pushes search and sort to the database", () => {
  assert.deepEqual(assetSearchWhere("truck"), {
    OR: [
      { name: { contains: "truck", mode: "insensitive" } },
      { code: { contains: "truck", mode: "insensitive" } },
    ],
  });
  assert.deepEqual(assetOrderBy("code", "desc"), [{ code: "desc" }]);
  assert.deepEqual(assetOrderBy("invalid", "asc"), [
    { active: "desc" },
    { name: "asc" },
  ]);
  assert.deepEqual(assetSortKeys, ["name", "code", "type", "active"]);
});

test("asset history search is constrained to the related project name", () => {
  assert.deepEqual(historySearchWhere("north"), {
    project: { name: { contains: "north", mode: "insensitive" } },
  });
  assert.deepEqual(historySearchWhere(""), {});
});

test("asset filters keep tenant and project allocation scopes in the database predicate", () => {
  assert.deepEqual(
    assetListWhere("org-1", "project-1", "VEHICLE", false, "van"),
    {
      organizationId: "org-1",
      allocations: { some: { projectId: "project-1" } },
      type: "VEHICLE",
      active: false,
      OR: [
        { name: { contains: "van", mode: "insensitive" } },
        { code: { contains: "van", mode: "insensitive" } },
      ],
    },
  );
});
