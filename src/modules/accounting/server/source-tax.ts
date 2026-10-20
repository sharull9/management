import type { Numeric } from "@/core/decimal";
import type { Prisma } from "@/generated/prisma/client";
import { allocateInvoicePostings } from "../invoice-postings";

export type TaxableLine = {
  id: string;
  lineSubtotal: Numeric;
  lineTax: Numeric;
  taxes: readonly {
    componentId: string;
    name: string;
    rate: Numeric;
    amount: Numeric;
    isWithholding: boolean;
  }[];
};

export async function baseCurrencyDecimals(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  const organization = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { baseCurrency: true },
  });
  const currency = await tx.currency.findUniqueOrThrow({
    where: { code: organization.baseCurrency },
    select: { decimals: true },
  });
  return currency.decimals;
}

export function invoiceTaxLines(input: {
  lines: readonly TaxableLine[];
  baseNet: Numeric;
  baseTax: Numeric;
  baseWithholding: Numeric;
  decimals: number;
}) {
  return allocateInvoicePostings(input);
}
