import assert from "node:assert/strict";
import test from "node:test";
import { journalApprovalView } from "./journal-approval-view";

test("journal approval timeline retains the actor for completed steps", () => {
  const [request] = journalApprovalView({
    id: "approval-1",
    status: "APPROVED",
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    steps: [
      {
        id: "step-1",
        sequence: 1,
        name: "Finance",
        status: "APPROVED",
        actedBy: { id: "user-1", name: "A. Reviewer" },
        comment: null,
      },
    ],
  });
  assert.equal(request?.steps[0]?.actedBy?.name, "A. Reviewer");
});
