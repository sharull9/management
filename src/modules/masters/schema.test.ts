import assert from "node:assert/strict";
import test from "node:test";
import { saveCityInput, saveMasterInput, variantFormInput } from "./schema";

const party = {
  kind: "party" as const,
  code: "P1",
  legalName: "Party",
  displayName: "Party",
  type: "BUSINESS" as const,
  isVendor: true,
  isCustomer: false,
  paymentTerms: 0,
  creditLimit: "0",
};
test("party payment terms accept typed integers and reject cleared or legacy string inputs", () => {
  assert.equal(
    saveMasterInput.parse({ ...party, paymentTerms: 30 }).paymentTerms,
    30,
  );
  for (const paymentTerms of [null, "", "30", -1, 1.5, 3651])
    assert.equal(
      saveMasterInput.safeParse({ ...party, paymentTerms }).success,
      false,
    );
});
test("levels accept typed numbers and checkboxes accept booleans", () => {
  const level = { kind: "level", name: "Size", level: 1, enabled: true };
  assert.equal(saveMasterInput.safeParse(level).success, true);
  assert.equal(
    saveMasterInput.safeParse({ ...level, level: "1" }).success,
    false,
  );
  assert.equal(
    saveMasterInput.safeParse({ ...level, enabled: "on" }).success,
    false,
  );
});
test("combobox blank IDs and multi-select arrays preserve master values", () => {
  const input = {
    kind: "taxGroup",
    name: "Tax",
    countryId: null,
    scope: "ANY",
    componentIds: ["tax1", "tax2"],
  };
  assert.deepEqual(saveMasterInput.parse(input).componentIds, ["tax1", "tax2"]);
  assert.equal(saveMasterInput.parse(input).countryId, null);
  assert.equal(
    saveMasterInput.safeParse({ ...input, componentIds: "tax1" }).success,
    false,
  );
  assert.equal(
    saveCityInput.safeParse({ name: "City", stateId: null }).success,
    false,
  );
  assert.deepEqual(saveCityInput.parse({ name: " City ", stateId: "state" }), {
    name: "City",
    stateId: "state",
  });
});
test("variant form validates required and allowed levels before submitting", () => {
  const schema = variantFormInput([
    {
      id: "item",
      name: "Item",
      configs: [
        {
          level: 1,
          name: "Size",
          enabled: true,
          mode: "LINKED",
          required: true,
          values: [
            { id: "small", name: "Small" },
            { id: "large", name: "Large" },
          ],
          linkedIds: ["small"],
        },
      ],
    },
  ]);
  const selection = {
    itemId: "item",
    level1: "small",
    level2: null,
    level3: null,
    level4: null,
    level5: null,
  };
  assert.equal(schema.safeParse({ selection }).success, true);
  for (const level1 of [null, "large", "unknown"])
    assert.equal(
      schema.safeParse({ selection: { ...selection, level1 } }).success,
      false,
    );
  assert.equal(
    schema.safeParse({ selection: { ...selection, itemId: null } }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ selection: { ...selection, level2: "small" } }).success,
    false,
  );
});
test("party default currency is an optional ISO code", () => {
  for (const defaultCurrency of ["USD", null, undefined])
    assert.equal(
      saveMasterInput.safeParse({ ...party, defaultCurrency }).success,
      true,
    );
  for (const defaultCurrency of ["usd", "US", "USDX"])
    assert.equal(
      saveMasterInput.safeParse({ ...party, defaultCurrency }).success,
      false,
    );
});
