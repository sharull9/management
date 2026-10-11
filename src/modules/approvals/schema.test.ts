import assert from "node:assert/strict";
import test from "node:test";
import { approvalDecisionInput, savePolicyInput } from "./schema";

const managerStep = {
  name: "Manager",
  approverType: "PROJECT_MANAGER" as const,
  roleId: null,
  userId: null,
  minAmount: "",
};
const policy = {
  id: null,
  name: "Policy",
  documentType: "EXPENSE" as const,
  active: true,
  scope: "org" as const,
  projectId: null,
  stageId: null,
  steps: [managerStep],
};

test("policy trims names, normalizes blank thresholds and preserves step order", () => {
  const result = savePolicyInput.parse({
    ...policy,
    name: "  Policy  ",
    steps: [
      managerStep,
      { ...managerStep, name: "Second", minAmount: "100.25" },
    ],
  });
  assert.equal(result.name, "Policy");
  assert.deepEqual(
    result.steps.map((step) => [step.name, step.minAmount]),
    [
      ["Manager", null],
      ["Second", "100.25"],
    ],
  );
});

test("policy validates scoped projects and stages at their field paths", () => {
  const project = savePolicyInput.safeParse({ ...policy, scope: "project" });
  assert.equal(project.success, false);
  if (!project.success)
    assert.deepEqual(project.error.issues[0].path, ["projectId"]);
  const stage = savePolicyInput.safeParse({
    ...policy,
    scope: "stage",
    projectId: "project",
  });
  assert.equal(stage.success, false);
  if (!stage.success) assert.deepEqual(stage.error.issues[0].path, ["stageId"]);
  assert.equal(
    savePolicyInput.safeParse({
      ...policy,
      scope: "stage",
      projectId: "project",
      stageId: "stage",
    }).success,
    true,
  );
});

test("role and user steps require the matching approver field", () => {
  for (const [approverType, field] of [
    ["ROLE", "roleId"],
    ["USER", "userId"],
  ] as const) {
    const result = savePolicyInput.safeParse({
      ...policy,
      steps: [{ ...managerStep, approverType }],
    });
    assert.equal(result.success, false);
    if (!result.success)
      assert.deepEqual(result.error.issues[0].path, ["steps", 0, field]);
    assert.equal(
      savePolicyInput.safeParse({
        ...policy,
        steps: [{ ...managerStep, approverType, [field]: "approver" }],
      }).success,
      true,
    );
  }
  assert.equal(
    savePolicyInput.safeParse({
      ...policy,
      steps: [{ ...managerStep, approverType: "STAGE_MANAGER" }],
    }).success,
    true,
  );
});

test("policy limits steps, rejects unknown choices and invalid amount precision", () => {
  for (const change of [
    { steps: [] },
    { steps: Array(21).fill(managerStep) },
    { documentType: "UNKNOWN" },
    { scope: "UNKNOWN" },
    { name: " " },
    { active: "on" },
  ]) {
    assert.equal(
      savePolicyInput.safeParse({ ...policy, ...change }).success,
      false,
    );
  }
  for (const minAmount of ["-1", "1.234", "10000000000000000", "NaN"]) {
    assert.equal(
      savePolicyInput.safeParse({
        ...policy,
        steps: [{ ...managerStep, minAmount }],
      }).success,
      false,
    );
  }
  for (const minAmount of [null, "", "0", "9999999999999999.99"]) {
    assert.equal(
      savePolicyInput.safeParse({
        ...policy,
        steps: [{ ...managerStep, minAmount }],
      }).success,
      true,
    );
  }
});

test("decision requires a rejection comment and limits its length", () => {
  assert.equal(
    approvalDecisionInput.safeParse({
      stepId: "step",
      action: "APPROVE",
      comment: "",
    }).success,
    true,
  );
  const rejection = approvalDecisionInput.safeParse({
    stepId: "step",
    action: "REJECT",
    comment: " ",
  });
  assert.equal(rejection.success, false);
  if (!rejection.success)
    assert.deepEqual(rejection.error.issues[0].path, ["comment"]);
  assert.equal(
    approvalDecisionInput.safeParse({
      stepId: "step",
      action: "REJECT",
      comment: "Reason",
    }).success,
    true,
  );
  assert.equal(
    approvalDecisionInput.safeParse({
      stepId: "step",
      action: "APPROVE",
      comment: "x".repeat(2001),
    }).success,
    false,
  );
});
