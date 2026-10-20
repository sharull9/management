import assert from "node:assert/strict";
import test from "node:test";
import { Decimal } from "@/core/decimal";
import {
  allocateInvoicePostings,
  billReceiptAmounts,
  checkedPostingAdjustment,
  stockMovementLines,
} from "./invoice-postings";

test("tax and withholding allocations preserve frozen headers at zero-decimal precision", () => {
  const result = allocateInvoicePostings({
    lines: [
      {
        id: "a",
        lineSubtotal: "90",
        lineTax: "9",
        taxes: [
          {
            componentId: "vat",
            name: "VAT",
            rate: "10",
            amount: "9",
            isWithholding: false,
          },
          {
            componentId: "withhold",
            name: "Withholding",
            rate: "4",
            amount: "4",
            isWithholding: true,
          },
        ],
      },
    ],
    baseNet: "90",
    baseTax: "9",
    baseWithholding: "4",
    decimals: 0,
  });
  assert.deepEqual(result.lineNet, ["90"]);
  assert.deepEqual(
    result.taxes.map((line) => [
      line.componentId,
      line.amount,
      line.taxBaseAmount,
    ]),
    [
      ["vat", "9", "90"],
      ["withhold", "4", "90"],
    ],
  );
  assert.equal(new Decimal("95").add("4").toString(), "99");
});

test("discounted invoice allocations use largest remainder and tolerate only one base unit", () => {
  const result = allocateInvoicePostings({
    lines: [
      {
        id: "a",
        lineSubtotal: "1",
        lineTax: "0.03",
        taxes: [
          {
            componentId: "x",
            name: "X",
            rate: "3",
            amount: "0.03",
            isWithholding: false,
          },
        ],
      },
      {
        id: "b",
        lineSubtotal: "2",
        lineTax: "0.06",
        taxes: [
          {
            componentId: "x",
            name: "X",
            rate: "3",
            amount: "0.06",
            isWithholding: false,
          },
        ],
      },
    ],
    baseNet: "2.99",
    baseTax: "0.09",
    baseWithholding: "0",
    decimals: 2,
  });
  assert.equal(
    result.lineNet
      .reduce((sum, value) => sum.add(value), new Decimal(0))
      .toFixed(2),
    "2.99",
  );
  assert.equal(
    result.taxes
      .reduce((sum, line) => sum.add(line.amount), new Decimal(0))
      .toFixed(2),
    "0.09",
  );
  assert.equal(checkedPostingAdjustment("10.01", "10", 2).toFixed(2), "0.01");
  assert.throws(
    () => checkedPostingAdjustment("10.02", "10", 2),
    /do not balance/,
  );
});

test("negative matched bill variance credits purchase variance", () => {
  const amount = billReceiptAmounts("90", "100");
  assert.equal(amount.accrual.toFixed(2), "100.00");
  assert.equal(amount.variance.toFixed(2), "-10.00");
});

test("stock transfer movements balance through transfer clearing with opposite directions", () => {
  const out = stockMovementLines("TRANSFER_OUT", "25.50", "project-a");
  const inside = stockMovementLines("TRANSFER_IN", "-25.50", "project-b");
  assert.deepEqual(
    [
      out[0]?.accountKey,
      out[0]?.debit.toString(),
      out[1]?.accountKey,
      out[1]?.credit.toString(),
    ],
    ["TRANSFER_CLEARING", "25.5", "INVENTORY", "25.5"],
  );
  assert.deepEqual(
    [
      inside[0]?.accountKey,
      inside[0]?.debit.toString(),
      inside[1]?.accountKey,
      inside[1]?.credit.toString(),
    ],
    ["INVENTORY", "25.5", "TRANSFER_CLEARING", "25.5"],
  );
});
