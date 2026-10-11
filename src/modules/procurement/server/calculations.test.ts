import assert from "node:assert/strict";
import test from "node:test";
import { variantIdentity } from "@/modules/item-variant/util";
import { movingAverage } from "@/modules/stock-valuation/util";
import { calculateTax, suggestTaxScope } from "@/modules/tax/util";
import { convertUom } from "@/modules/uom/util";
import { assertReceiptQuantity } from "./calculations";

test("variant key and readable name respect required, linked and unused levels", () => {
  const configs = [
    {
      level: 1,
      name: "Brand",
      enabled: true,
      mode: "LINKED" as const,
      required: true,
      values: [
        { id: "ut", name: "UltraTech" },
        { id: "acc", name: "ACC" },
      ],
      linkedIds: ["ut"],
    },
    {
      level: 2,
      name: "Grade",
      enabled: true,
      mode: "ANY" as const,
      required: false,
      values: [{ id: "53", name: "53 Grade" }],
      linkedIds: [],
    },
  ];
  const item = { id: "cement", name: "Cement" };
  assert.equal(
    variantIdentity(item, configs, ["ut", "53"]).name,
    "Cement · UltraTech · 53 Grade",
  );
  assert.equal(
    variantIdentity(item, configs, ["ut"]).key,
    variantIdentity(item, configs, ["ut", null]).key,
  );
  assert.throws(() => variantIdentity(item, configs, []), /required/);
  assert.throws(() => variantIdentity(item, configs, ["acc"]), /Invalid/);
  assert.throws(
    () => variantIdentity(item, configs, ["ut", null, "other"]),
    /not used/,
  );
  assert.throws(
    () => variantIdentity(item, [{ ...configs[0], enabled: false }], ["ut"]),
    /not used/,
  );
});
test("UOM conversion converts bags to kilograms and rejects incompatible groups", () => {
  const bag = { groupId: "weight", factor: "50" },
    kg = { groupId: "weight", factor: "1" };
  assert.equal(convertUom("12.5", bag, kg).toString(), "625");
  assert.equal(convertUom("625", kg, bag).toString(), "12.5");
  assert.throws(
    () => convertUom("1", bag, { groupId: "count", factor: "1" }),
    /same group/,
  );
  assert.throws(
    () => convertUom("1", kg, { groupId: "weight", factor: "3" }),
    /four decimal/,
  );
});
test("GST snapshot, half-up rounding, withholding and applicability", () => {
  const components = [
    {
      id: "cgst",
      name: "CGST",
      rate: "9",
      isWithholding: false,
      appliesTo: "BOTH" as const,
    },
    {
      id: "sgst",
      name: "SGST",
      rate: "9",
      isWithholding: false,
      appliesTo: "PURCHASE" as const,
    },
    {
      id: "tds",
      name: "TDS",
      rate: "2",
      isWithholding: true,
      appliesTo: "PURCHASE" as const,
    },
  ];
  const result = calculateTax("1000", components);
  assert.equal(result.tax.toString(), "180");
  assert.equal(result.withholding.toString(), "20");
  assert.equal(result.total.toString(), "1160");
  assert.equal(calculateTax("0.5", [components[0]]).lines[0].amount, "0.05");
  assert.equal(calculateTax("100", components, "SALES").lines.length, 1);
  assert.equal(suggestTaxScope("TN", "TN"), "INTRA");
  assert.equal(suggestTaxScope("TN", "KA"), "INTER");
  assert.equal(suggestTaxScope(null, "TN"), "ANY");
});
test("over-receipt guard includes previous receipts and configured tolerance", () => {
  assertReceiptQuantity("10", "4", "6");
  assert.throws(() => assertReceiptQuantity("10", "4", "6.0001"), /exceeds/);
  assertReceiptQuantity("10", "4", "7", "10");
  assert.throws(
    () => assertReceiptQuantity("10", "4", "7.0001", "10"),
    /exceeds/,
  );
});
test("tax calculator rejects invalid rates and withholding exceeding value", () => {
  const tax = {
    id: "tds",
    name: "TDS",
    rate: "100",
    isWithholding: true,
    appliesTo: "PURCHASE" as const,
  };
  assert.throws(
    () => calculateTax("100", [{ ...tax, rate: "101" }]),
    /Invalid tax rate/,
  );
  assert.throws(
    () => calculateTax("100", [tax, { ...tax, id: "tds2" }]),
    /exceeds/,
  );
  assert.equal(calculateTax("100", [tax]).total.toString(), "0");
});
test("moving average preserves value through partial consumption and transfers", () => {
  const first = movingAverage(
    { qty: "0", value: "0" },
    { qty: "500", unitCost: "8" },
  );
  const second = movingAverage(first, { qty: "500", unitCost: "10" });
  assert.equal(second.avgCost.toString(), "9");
  const used = movingAverage(second, { qty: "-200" });
  assert.equal(used.totalCost.toString(), "-1800");
  assert.equal(used.value.toString(), "7200");
  assert.throws(() => movingAverage(used, { qty: "-801" }), /Insufficient/);
  const depleted = movingAverage(used, { qty: "-800" });
  assert.equal(depleted.value.toString(), "0");
  assert.equal(depleted.avgCost.toString(), "0");
});
