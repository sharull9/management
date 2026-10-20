import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import type { SystemAccountKey } from "./constants";

export type PostingLine = {
  accountKey: SystemAccountKey;
  debit: Numeric;
  credit: Numeric;
  description?: string;
};

export function paymentPosting(input: {
  direction: "OUTGOING" | "INCOMING";
  mode: string;
  baseAmount: Numeric;
}): PostingLine[] {
  const amount = new Decimal(input.baseAmount);
  if (amount.isZero()) return [];
  const cash: SystemAccountKey = input.mode === "CASH" ? "CASH" : "BANK";
  return input.direction === "OUTGOING"
    ? [
        { accountKey: "VENDOR_ADVANCES", debit: amount, credit: "0" },
        { accountKey: cash, debit: "0", credit: amount },
      ]
    : [
        { accountKey: cash, debit: amount, credit: "0" },
        { accountKey: "CUSTOMER_ADVANCES", debit: "0", credit: amount },
      ];
}

export function allocationPosting(input: {
  direction: "OUTGOING" | "INCOMING";
  baseAmount: Numeric;
  documentBaseAmount: Numeric;
  fxDifference: Numeric;
}): PostingLine[] {
  const allocated = new Decimal(input.baseAmount);
  const document = new Decimal(input.documentBaseAmount);
  const fx = new Decimal(input.fxDifference);
  const lines: PostingLine[] =
    input.direction === "OUTGOING"
      ? [
          { accountKey: "ACCOUNTS_PAYABLE", debit: document, credit: "0" },
          { accountKey: "VENDOR_ADVANCES", debit: "0", credit: allocated },
        ]
      : [
          { accountKey: "CUSTOMER_ADVANCES", debit: allocated, credit: "0" },
          { accountKey: "ACCOUNTS_RECEIVABLE", debit: "0", credit: document },
        ];
  if (!fx.isZero()) {
    const gain =
      (input.direction === "OUTGOING" && fx.isNegative()) ||
      (input.direction === "INCOMING" && fx.isPositive());
    lines.push({
      accountKey: gain ? "FX_GAIN" : "FX_LOSS",
      debit: gain ? "0" : fx.abs(),
      credit: gain ? fx.abs() : "0",
    });
  }
  return lines.filter((line) =>
    new Decimal(line.debit).isZero()
      ? !new Decimal(line.credit).isZero()
      : true,
  );
}

export function documentSettlementRoundingPosting(input: {
  direction: "OUTGOING" | "INCOMING";
  documentBaseAmount: Numeric;
  allocationDocumentBaseAmounts: readonly Numeric[];
  decimals: number;
  fullySettled: boolean;
}): PostingLine[] | null {
  if (!input.fullySettled || !input.allocationDocumentBaseAmounts.length)
    return null;
  const allocated = input.allocationDocumentBaseAmounts.reduce<
    InstanceType<typeof Decimal>
  >((sum, amount) => sum.add(amount), new Decimal(0));
  const delta = allocated.sub(input.documentBaseAmount);
  if (delta.isZero()) return null;
  const unit = new Decimal(1).div(new Decimal(10).pow(input.decimals));
  if (delta.abs().gt(unit.mul(input.allocationDocumentBaseAmounts.length)))
    throw new UserFacingError(
      "Document allocation rounding exceeds the expected minor-unit residual.",
    );
  const account: SystemAccountKey =
    input.direction === "OUTGOING" ? "ACCOUNTS_PAYABLE" : "ACCOUNTS_RECEIVABLE";
  // Allocations clear the document side; offset only its cumulative rounding residual.
  const reverseDocumentSide =
    input.direction === "OUTGOING" ? delta.gt(0) : delta.lt(0);
  return [
    {
      accountKey: account,
      debit: reverseDocumentSide ? "0" : delta.abs(),
      credit: reverseDocumentSide ? delta.abs() : "0",
    },
    {
      accountKey: "ROUNDING",
      debit: reverseDocumentSide ? delta.abs() : "0",
      credit: reverseDocumentSide ? "0" : delta.abs(),
    },
  ];
}

export function paymentRoundingPosting(input: {
  direction: "OUTGOING" | "INCOMING";
  paymentBaseAmount: Numeric;
  allocationBaseAmounts: readonly Numeric[];
  decimals: number;
  fullyAllocated: boolean;
}): PostingLine[] | null {
  if (!input.fullyAllocated || !input.allocationBaseAmounts.length) return null;
  const allocated = input.allocationBaseAmounts.reduce<
    InstanceType<typeof Decimal>
  >((sum, amount) => sum.add(amount), new Decimal(0));
  const delta = allocated.sub(input.paymentBaseAmount);
  if (delta.isZero()) return null;
  const unit = new Decimal(1).div(new Decimal(10).pow(input.decimals));
  if (delta.abs().gt(unit.mul(input.allocationBaseAmounts.length)))
    throw new UserFacingError(
      "Payment allocation rounding exceeds the expected minor-unit residual.",
    );
  const advance: SystemAccountKey =
    input.direction === "OUTGOING" ? "VENDOR_ADVANCES" : "CUSTOMER_ADVANCES";
  // Positive delta means allocation-side advances need restoring for outgoing,
  // and clearing further for incoming.
  const debitAdvance =
    input.direction === "OUTGOING" ? delta.gt(0) : delta.lt(0);
  return [
    {
      accountKey: advance,
      debit: debitAdvance ? delta.abs() : "0",
      credit: debitAdvance ? "0" : delta.abs(),
    },
    {
      accountKey: "ROUNDING",
      debit: debitAdvance ? "0" : delta.abs(),
      credit: debitAdvance ? delta.abs() : "0",
    },
  ];
}
