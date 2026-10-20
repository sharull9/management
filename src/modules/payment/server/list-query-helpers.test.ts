import assert from "node:assert/strict";
import test from "node:test";
import {
  paymentOrderBy,
  paymentScopeWhere,
  paymentSearchWhere,
  paymentSortKeys,
  requestSearchWhere,
  scopedAnd,
} from "./list-query-helpers";

test("payment list search and sort are server query inputs with a fixed whitelist", () => {
  assert.deepEqual(paymentSearchWhere("wire"), {
    OR: [
      { code: { contains: "wire", mode: "insensitive" } },
      { party: { displayName: { contains: "wire", mode: "insensitive" } } },
      { project: { name: { contains: "wire", mode: "insensitive" } } },
    ],
  });
  assert.deepEqual(paymentOrderBy("party", "asc"), {
    party: { displayName: "asc" },
  });
  assert.deepEqual(paymentOrderBy("not-a-column", "desc"), { date: "desc" });
  assert.deepEqual(paymentSortKeys, [
    "code",
    "party",
    "project",
    "date",
    "status",
  ]);
});

test("request search scopes linked bill codes to visible projects", () => {
  assert.deepEqual(requestSearchWhere("rent", ["project-1"]), {
    OR: [
      { code: { contains: "rent", mode: "insensitive" } },
      { party: { displayName: { contains: "rent", mode: "insensitive" } } },
      { project: { name: { contains: "rent", mode: "insensitive" } } },
      {
        bills: {
          some: {
            bill: {
              AND: [
                { code: { contains: "rent", mode: "insensitive" } },
                { projectId: { in: ["project-1"] } },
              ],
            },
          },
        },
      },
    ],
  });
  assert.deepEqual(requestSearchWhere("", ["project-1"]), {});
});

test("project scoped payment lists include only project payments or linked documents in visible projects", () => {
  assert.deepEqual(paymentScopeWhere("org-1", ["project-1"], false), {
    organizationId: "org-1",
    OR: [
      { projectId: { in: ["project-1"] } },
      {
        allocations: {
          some: {
            OR: [
              { vendorBill: { projectId: { in: ["project-1"] } } },
              { salesInvoice: { projectId: { in: ["project-1"] } } },
            ],
          },
        },
      },
    ],
  });
  assert.deepEqual(
    paymentScopeWhere("org-1", ["project-1"], true, undefined, {
      organizationId: "org-1",
      projectId: { in: ["project-1"] },
    }),
    { organizationId: "org-1", projectId: { in: ["project-1"] } },
  );
});

test("list search is ANDed with scope so its OR branches cannot replace authorization", () => {
  const scope = paymentScopeWhere("org-1", ["project-1"], false);
  const search = paymentSearchWhere("cash", false);
  assert.deepEqual(scopedAnd(scope, search), {
    AND: [
      scope,
      {
        OR: [
          { code: { contains: "cash", mode: "insensitive" } },
          { party: { displayName: { contains: "cash", mode: "insensitive" } } },
        ],
      },
    ],
  });
});
