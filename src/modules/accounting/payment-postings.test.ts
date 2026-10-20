import assert from "node:assert/strict";
import test from "node:test";
import {
  allocationPosting,
  documentSettlementRoundingPosting,
  paymentPosting,
  paymentRoundingPosting,
} from "./payment-postings";

test("zero base effects omit zero journal legs", () => {
  assert.deepEqual(
    paymentPosting({ direction: "OUTGOING", mode: "BANK", baseAmount: "0" }),
    [],
  );
  assert.deepEqual(
    allocationPosting({
      direction: "OUTGOING",
      baseAmount: "0",
      documentBaseAmount: "0",
      fxDifference: "0",
    }),
    [],
  );
  assert.deepEqual(
    allocationPosting({
      direction: "OUTGOING",
      baseAmount: "0",
      documentBaseAmount: "0",
      fxDifference: "1",
    }).map((line) => line.accountKey),
    ["FX_LOSS"],
  );
  assert.deepEqual(
    allocationPosting({
      direction: "INCOMING",
      baseAmount: "1",
      documentBaseAmount: "0",
      fxDifference: "1",
    }).map((line) => [
      line.accountKey,
      String(line.debit),
      String(line.credit),
    ]),
    [
      ["CUSTOMER_ADVANCES", "1", "0"],
      ["FX_GAIN", "0", "1"],
    ],
  );
});

test("fully settled documents reconcile cumulative document-side rounding", () => {
  assert.deepEqual(
    documentSettlementRoundingPosting({
      direction: "OUTGOING",
      documentBaseAmount: "0.05",
      allocationDocumentBaseAmounts: ["0.02", "0.02", "0.02"],
      decimals: 2,
      fullySettled: true,
    })?.map((line) => [
      line.accountKey,
      String(line.debit),
      String(line.credit),
    ]),
    [
      ["ACCOUNTS_PAYABLE", "0", "0.01"],
      ["ROUNDING", "0.01", "0"],
    ],
  );
  assert.deepEqual(
    documentSettlementRoundingPosting({
      direction: "INCOMING",
      documentBaseAmount: "0.05",
      allocationDocumentBaseAmounts: ["0.02", "0.02", "0.02"],
      decimals: 2,
      fullySettled: true,
    })?.map((line) => [
      line.accountKey,
      String(line.debit),
      String(line.credit),
    ]),
    [
      ["ACCOUNTS_RECEIVABLE", "0.01", "0"],
      ["ROUNDING", "0", "0.01"],
    ],
  );
  assert.equal(
    documentSettlementRoundingPosting({
      direction: "OUTGOING",
      documentBaseAmount: "0.05",
      allocationDocumentBaseAmounts: ["0.02", "0.02"],
      decimals: 2,
      fullySettled: false,
    }),
    null,
  );
});

test("allocation FX signs clear advances and recognize gain/loss by direction", () => {
  assert.deepEqual(
    allocationPosting({
      direction: "OUTGOING",
      baseAmount: "100",
      documentBaseAmount: "90",
      fxDifference: "10",
    }).map((x) => [x.accountKey, String(x.debit), String(x.credit)]),
    [
      ["ACCOUNTS_PAYABLE", "90", "0"],
      ["VENDOR_ADVANCES", "0", "100"],
      ["FX_LOSS", "10", "0"],
    ],
  );
  assert.deepEqual(
    allocationPosting({
      direction: "INCOMING",
      baseAmount: "90",
      documentBaseAmount: "100",
      fxDifference: "-10",
    }).map((x) => x.accountKey),
    ["CUSTOMER_ADVANCES", "ACCOUNTS_RECEIVABLE", "FX_LOSS"],
  );
  assert.equal(
    allocationPosting({
      direction: "INCOMING",
      baseAmount: "110",
      documentBaseAmount: "100",
      fxDifference: "10",
    })[2]?.accountKey,
    "FX_GAIN",
  );
});

test("partial payments skip rounding and a JPY residual is bounded in minor units", () => {
  assert.equal(
    paymentRoundingPosting({
      direction: "OUTGOING",
      paymentBaseAmount: "10",
      allocationBaseAmounts: ["5"],
      decimals: 2,
      fullyAllocated: false,
    }),
    null,
  );
  assert.deepEqual(
    paymentRoundingPosting({
      direction: "OUTGOING",
      paymentBaseAmount: "100",
      allocationBaseAmounts: ["101"],
      decimals: 0,
      fullyAllocated: true,
    })?.map((x) => [x.accountKey, String(x.debit), String(x.credit)]),
    [
      ["VENDOR_ADVANCES", "1", "0"],
      ["ROUNDING", "0", "1"],
    ],
  );
  assert.throws(() =>
    paymentRoundingPosting({
      direction: "INCOMING",
      paymentBaseAmount: "10",
      allocationBaseAmounts: ["12"],
      decimals: 0,
      fullyAllocated: true,
    }),
  );
});
