import assert from "node:assert/strict";
import { test } from "node:test";
import type { z } from "zod";
import type { PickerItem } from "@/components/shared/form/item-variant-value";
import {
  invoiceFormInput,
  invoiceFormSchema,
  invoiceInput,
  invoiceServiceValues,
} from "./schema";

const service: z.input<typeof invoiceFormInput>["lines"][number] = {
  lineType: "SERVICE",
  selection: {
    itemId: null,
    level1: null,
    level2: null,
    level3: null,
    level4: null,
    level5: null,
  },
  description: "Installation",
  qty: "2.5",
  uomId: "hour",
  rate: "40",
  discountPercent: "5",
  taxGroupId: null,
  fromProjectStock: false,
};
const input: z.input<typeof invoiceFormInput> = {
  id: null,
  projectId: null,
  partyId: "customer",
  date: "2026-10-11",
  dueDate: "",
  stateId: null,
  currency: "INR",
  exchangeRate: "",
  notes: "",
  lines: [service],
};
const item: PickerItem = {
  id: "item",
  name: "Goods",
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
};
const goods = {
  ...service,
  lineType: "GOODS" as const,
  description: "",
  selection: { ...service.selection, itemId: "item", level1: "small" },
};
function valid(line: typeof service) {
  return invoiceFormInput.safeParse({ ...input, lines: [line] }).success;
}
test("typed service lines preserve the service and smoke input contract", () => {
  const parsed = invoiceFormInput.parse(input);
  const values = invoiceServiceValues(parsed);
  assert.equal(values.date.toISOString(), "2026-10-11T00:00:00.000Z");
  assert.equal(values.dueDate, null);
  assert.deepEqual(values.lines[0], {
    itemId: null,
    levels: [null, null, null, null, null],
    description: "Installation",
    qty: "2.5",
    uomId: "hour",
    rate: "40",
    discountPercent: "5",
    taxGroupId: null,
    fromProjectStock: false,
  });
  assert.equal(
    invoiceInput.safeParse({ ...values, date: input.date }).success,
    true,
  );
});
test("services require descriptions and reject goods and stock fields", () => {
  assert.equal(valid(service), true);
  assert.equal(valid({ ...service, description: "  " }), false);
  assert.equal(
    valid({ ...service, selection: { ...service.selection, itemId: "item" } }),
    false,
  );
  assert.equal(
    valid({ ...service, selection: { ...service.selection, level5: "value" } }),
    false,
  );
  assert.equal(valid({ ...service, fromProjectStock: true }), false);
});
test("typed lines validate units, positive quantities, rates and discounts", () => {
  assert.equal(valid({ ...service, uomId: null }), false);
  assert.equal(valid({ ...service, qty: "0" }), false);
  assert.equal(valid({ ...service, rate: "-1" }), false);
  assert.equal(valid({ ...service, discountPercent: "100.01" }), false);
  assert.equal(valid({ ...service, discountPercent: "100" }), true);
});
test("goods require an item and project stock requires a project", () => {
  assert.equal(valid({ ...goods, selection: service.selection }), false);
  assert.equal(valid({ ...goods, fromProjectStock: true }), false);
  assert.equal(
    invoiceFormInput.safeParse({
      ...input,
      projectId: "project",
      lines: [{ ...goods, fromProjectStock: true }],
    }).success,
    true,
  );
});
test("item configs enforce required, linked and unused levels", () => {
  const schema = invoiceFormSchema([item]);
  const parse = (line: typeof service) =>
    schema.safeParse({ ...input, lines: [line] }).success;
  assert.equal(parse(goods), true);
  assert.equal(
    parse({ ...goods, selection: { ...goods.selection, level1: null } }),
    false,
  );
  assert.equal(
    parse({ ...goods, selection: { ...goods.selection, level1: "large" } }),
    false,
  );
  assert.equal(
    parse({ ...goods, selection: { ...goods.selection, level2: "small" } }),
    false,
  );
  assert.equal(
    invoiceFormSchema([]).safeParse({ ...input, lines: [goods] }).success,
    false,
  );
});
test("goods map all five levels in order without changing calculations input", () => {
  const values = invoiceServiceValues(
    invoiceFormInput.parse({
      ...input,
      lines: [
        {
          ...goods,
          selection: {
            itemId: "item",
            level1: "a",
            level2: "b",
            level3: "c",
            level4: "d",
            level5: "e",
          },
        },
      ],
    }),
  );
  assert.deepEqual(values.lines[0].levels, ["a", "b", "c", "d", "e"]);
  assert.equal(values.lines[0].itemId, "item");
  assert.equal("lineType" in values.lines[0], false);
  assert.equal("selection" in values.lines[0], false);
});
test("invoice limits, dates and customer fallback are validated", () => {
  assert.equal(
    invoiceFormInput.safeParse({ ...input, lines: [] }).success,
    false,
  );
  assert.equal(
    invoiceFormInput.safeParse({ ...input, lines: Array(101).fill(service) })
      .success,
    false,
  );
  assert.equal(
    invoiceFormInput.safeParse({ ...input, date: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    invoiceFormInput.safeParse({ ...input, dueDate: "2026-10-10" }).success,
    false,
  );
  assert.equal(
    invoiceFormInput.safeParse({ ...input, partyId: null }).success,
    false,
  );
  assert.equal(
    invoiceFormInput.safeParse({
      ...input,
      partyId: null,
      projectId: "project",
    }).success,
    true,
  );
});
