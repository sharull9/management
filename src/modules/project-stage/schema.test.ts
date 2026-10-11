import assert from "node:assert/strict";
import test from "node:test";
import { deleteStageInput, stageFormInput } from "./schema";

const stage = {
  id: null,
  name: " Stage ",
  sequence: 1,
  status: "PLANNED" as const,
  managerUserId: null,
  budgetAmount: "",
  startDate: "",
  endDate: "",
};
test("stage sequences use typed integers and reject cleared or legacy string values", () => {
  assert.equal(stageFormInput.parse(stage).name, "Stage");
  for (const sequence of [null, "1", 0, 1.5, 100001])
    assert.equal(
      stageFormInput.safeParse({ ...stage, sequence }).success,
      false,
    );
});
test("stage optional budget and dates normalize blanks without accepting invalid amounts", () => {
  const parsed = stageFormInput.parse(stage);
  assert.equal(parsed.budgetAmount, null);
  assert.equal(parsed.startDate, null);
  assert.equal(
    stageFormInput.parse({ ...stage, budgetAmount: "0.00" }).budgetAmount,
    "0.00",
  );
  assert.equal(
    stageFormInput.safeParse({ ...stage, budgetAmount: "1.234" }).success,
    false,
  );
  assert.equal(
    stageFormInput.safeParse({
      ...stage,
      startDate: "2026-10-02",
      endDate: "2026-10-01",
    }).success,
    false,
  );
  assert.equal(deleteStageInput.safeParse({ id: "" }).success, false);
});
