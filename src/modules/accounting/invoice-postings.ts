import { Decimal, type Numeric } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import { allocateBaseAmounts } from "./util";

export type InvoiceTaxSnapshot = {
  componentId: string;
  name: string;
  rate: Numeric;
  amount: Numeric;
  isWithholding: boolean;
};

export type InvoicePostingLine = {
  id: string;
  lineSubtotal: Numeric;
  lineTax: Numeric;
  taxes: readonly InvoiceTaxSnapshot[];
};

export type TaxPosting = {
  componentId: string;
  name: string;
  rate: string;
  taxBaseAmount: string;
  amount: string;
  isWithholding: boolean;
};

/** Allocates frozen header totals across lines and tax components without floats. */
export function allocateInvoicePostings(input: {
  lines: readonly InvoicePostingLine[];
  baseNet: Numeric;
  baseTax: Numeric;
  baseWithholding: Numeric;
  decimals: number;
}): { lineNet: string[]; taxes: TaxPosting[] } {
  const net = new Decimal(input.baseNet);
  const taxTotal = new Decimal(input.baseTax);
  const withholdingTotal = new Decimal(input.baseWithholding);
  for (const amount of [net, taxTotal, withholdingTotal])
    if (!amount.isFinite() || amount.lt(0))
      throw new UserFacingError(
        "Invoice posting totals must be finite and non-negative.",
      );

  const lineNet = allocateBaseAmounts(
    net,
    input.lines.map((line) => line.lineSubtotal),
    input.decimals,
  );
  const ordinaryWeights = input.lines.map((line) =>
    line.taxes
      .filter((component) => !component.isWithholding)
      .reduce((sum, component) => sum.add(component.amount), new Decimal(0)),
  );
  const withholdingWeights = input.lines.map((line) =>
    line.taxes
      .filter((component) => component.isWithholding)
      .reduce((sum, component) => sum.add(component.amount), new Decimal(0)),
  );
  const ordinaryByLine = allocateBaseAmounts(
    taxTotal,
    ordinaryWeights,
    input.decimals,
  );
  const withholdingByLine = allocateBaseAmounts(
    withholdingTotal,
    withholdingWeights,
    input.decimals,
  );

  const componentLines = input.lines.map((line, lineIndex) => {
    const ordinary = line.taxes.filter((component) => !component.isWithholding);
    const withholding = line.taxes.filter(
      (component) => component.isWithholding,
    );
    const ordinaryShares = allocateBaseAmounts(
      ordinaryByLine[lineIndex] ?? 0,
      ordinary.map((component) => component.amount),
      input.decimals,
    );
    const withholdingShares = allocateBaseAmounts(
      withholdingByLine[lineIndex] ?? 0,
      withholding.map((component) => component.amount),
      input.decimals,
    );
    return line.taxes.map((component) => {
      const siblings = component.isWithholding ? withholding : ordinary;
      const shares = component.isWithholding
        ? withholdingShares
        : ordinaryShares;
      const index = siblings.indexOf(component);
      const amount = shares[index] ?? new Decimal(0);
      return { component, amount };
    });
  });

  const postings: TaxPosting[] = [];
  componentLines.forEach((taxes, lineIndex) => {
    for (const { component, amount } of taxes) {
      const baseAmount = new Decimal(lineNet[lineIndex] ?? 0);
      postings.push({
        componentId: component.componentId,
        name: component.name,
        rate: String(component.rate),
        taxBaseAmount: baseAmount
          .toDecimalPlaces(input.decimals)
          .toFixed(input.decimals),
        amount: amount.toFixed(input.decimals),
        isWithholding: component.isWithholding,
      });
    }
  });
  return {
    lineNet: lineNet.map((amount) => amount.toFixed(input.decimals)),
    taxes: postings,
  };
}

export function checkedPostingAdjustment(
  debits: Numeric,
  credits: Numeric,
  decimals: number,
) {
  const delta = new Decimal(debits).sub(credits);
  if (!delta.isFinite())
    throw new UserFacingError("Journal totals must be finite.");
  if (delta.isZero()) return new Decimal(0);
  const unit = new Decimal(1).div(new Decimal(10).pow(decimals));
  if (delta.abs().gt(unit))
    throw new UserFacingError(
      "Document totals do not balance in base currency.",
    );
  return delta.abs();
}

export function roundedBase(value: Numeric, decimals: number) {
  return new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

export function billReceiptAmounts(
  billedAcceptedNet: Numeric,
  acceptedAccrual: Numeric,
) {
  const billed = new Decimal(billedAcceptedNet);
  const accrual = new Decimal(acceptedAccrual);
  return { accrual, variance: billed.sub(accrual) };
}

export function stockMovementLines(
  type:
    | "GRN_IN"
    | "CONSUMPTION_OUT"
    | "SALE_OUT"
    | "TRANSFER_OUT"
    | "TRANSFER_IN",
  totalCost: Numeric,
  projectId: string,
) {
  const accounts = {
    GRN_IN: ["INVENTORY", "GRNI"],
    CONSUMPTION_OUT: ["MATERIAL_EXPENSE", "INVENTORY"],
    SALE_OUT: ["COST_OF_GOODS_SOLD", "INVENTORY"],
    TRANSFER_OUT: ["TRANSFER_CLEARING", "INVENTORY"],
    TRANSFER_IN: ["INVENTORY", "TRANSFER_CLEARING"],
  } as const;
  const amount = new Decimal(totalCost).abs();
  if (amount.isZero()) return [];
  const [debitAccount, creditAccount] = accounts[type];
  return [
    {
      accountKey: debitAccount,
      debit: amount,
      credit: new Decimal(0),
      projectId,
    },
    {
      accountKey: creditAccount,
      debit: new Decimal(0),
      credit: amount,
      projectId,
    },
  ];
}
