import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetLineInput,
  budgetLinesInput,
  deleteInput,
  projectFormInput,
  siteFormInput,
  totalBudgetInput,
} from "./schema";

const project = {
  id: null,
  name: " Project ",
  description: " description ",
  status: "PLANNED" as const,
  budgetAmount: "1234567890123456.78",
  currency: "INR",
  clientPartyId: null,
  managerUserId: null,
  startDate: "",
  endDate: "",
  customerName: "",
  customerLegalName: "",
  materialCostRecognition: "ON_CONSUMPTION" as const,
  confirmCostRecognitionChange: false,
};
test("project typed input preserves exact money, null IDs and optional dates", () => {
  const parsed = projectFormInput.parse(project);
  assert.equal(parsed.name, "Project");
  assert.equal(parsed.description, "description");
  assert.equal(parsed.budgetAmount, project.budgetAmount);
  assert.equal(parsed.startDate, null);
  assert.equal(parsed.clientPartyId, null);
  assert.equal(
    projectFormInput.safeParse({ ...project, budgetAmount: "1.234" }).success,
    false,
  );
  assert.equal(
    projectFormInput.safeParse({ ...project, status: "UNKNOWN" }).success,
    false,
  );
});
test("project dates validate calendar days and report reversed ranges on endDate", () => {
  assert.equal(
    projectFormInput.safeParse({ ...project, startDate: "2026-02-30" }).success,
    false,
  );
  const parsed = projectFormInput.parse({
    ...project,
    startDate: "2026-10-01",
    endDate: "2026-10-01",
  });
  assert.equal(parsed.startDate?.toISOString(), "2026-10-01T00:00:00.000Z");
  const result = projectFormInput.safeParse({
    ...project,
    startDate: "2026-10-02",
    endDate: "2026-10-01",
  });
  assert.equal(result.success, false);
  if (!result.success)
    assert.deepEqual(result.error.issues[0].path, ["endDate"]);
});
test("material recognition keeps both modes and requires a boolean acknowledgement", () => {
  for (const materialCostRecognition of [
    "ON_RECEIPT",
    "ON_CONSUMPTION",
  ] as const) {
    assert.equal(
      projectFormInput.parse({
        ...project,
        materialCostRecognition,
        confirmCostRecognitionChange: true,
      }).confirmCostRecognitionChange,
      true,
    );
  }
  assert.equal(
    projectFormInput.safeParse({ ...project, materialCostRecognition: "OTHER" })
      .success,
    false,
  );
  assert.equal(
    projectFormInput.safeParse({
      ...project,
      confirmCostRecognitionChange: "on",
    }).success,
    false,
  );
  assert.equal(
    projectFormInput.parse({
      ...project,
      customerName: "   ",
      customerLegalName: "   ",
    }).customerName,
    "",
  );
});
const site = {
  id: null,
  name: "Site",
  address: "Address",
  pincode: "   ",
  countryId: null,
  stateId: null,
  cityId: null,
  latitude: "",
  longitude: "",
};
test("site blanks normalize to null and coordinates retain decimal bounds", () => {
  const parsed = siteFormInput.parse(site);
  assert.equal(parsed.pincode, null);
  assert.equal(parsed.latitude, null);
  assert.equal(parsed.longitude, null);
  assert.equal(
    siteFormInput.parse({ ...site, latitude: "-90", longitude: "180" })
      .latitude,
    "-90",
  );
  for (const fields of [
    { latitude: "90.0000001" },
    { longitude: "-180.0000001" },
    { latitude: "1.12345678" },
  ])
    assert.equal(
      siteFormInput.safeParse({ ...site, ...fields }).success,
      false,
    );
});
test("budget line and total inputs validate costs and preserve money strings", () => {
  const line = {
    id: null,
    costType: "MATERIAL",
    stageId: null,
    amount: "0.00",
    note: " note ",
  };
  assert.equal(budgetLineInput.parse(line).note, "note");
  assert.equal(
    budgetLineInput.safeParse({ ...line, costType: "UNKNOWN" }).success,
    false,
  );
  assert.equal(
    budgetLineInput.safeParse({ ...line, amount: "-1" }).success,
    false,
  );
  assert.equal(totalBudgetInput.safeParse({ budgetAmount: "" }).success, false);
  assert.equal(deleteInput.safeParse({ id: "" }).success, false);
});
test("budget field arrays validate every line and report nested errors", () => {
  const line = {
    costType: "MATERIAL",
    stageId: null,
    amount: "1.00",
    note: " note ",
  };
  assert.equal(
    budgetLinesInput.parse({ lines: [line, line] }).lines[1].note,
    "note",
  );
  assert.equal(budgetLinesInput.safeParse({ lines: [] }).success, false);
  assert.equal(
    budgetLinesInput.safeParse({ lines: Array(101).fill(line) }).success,
    false,
  );
  const result = budgetLinesInput.safeParse({
    lines: [line, { ...line, amount: "-1" }],
  });
  assert.equal(result.success, false);
  if (!result.success)
    assert.deepEqual(result.error.issues[0].path, ["lines", 1, "amount"]);
});
