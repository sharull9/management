import { Decimal } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import type { Prisma } from "@/generated/prisma/client";
import { checkedPostingAdjustment } from "../invoice-postings";
import { lockAccountingScope } from "./locking";
import type { SourceJournalLine } from "./posting-service";
import { removeSourceJournal, syncSourceJournal } from "./posting-service";
import { baseCurrencyDecimals, invoiceTaxLines } from "./source-tax";

export async function syncSalesInvoiceJournal(
  tx: Prisma.TransactionClient,
  organizationId: string,
  invoiceId: string,
  actorId: string,
) {
  await lockAccountingScope(tx, organizationId);
  const invoice = await tx.salesInvoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: {
      lines: { include: { taxes: true } },
      party: { select: { tenantId: true } },
      project: { select: { organizationId: true } },
    },
  });
  if (!invoice)
    return removeSourceJournal(tx, {
      organizationId,
      actorId,
      sourceType: "SALES_INVOICE",
      sourceId: invoiceId,
      description: "Removed sales invoice",
    });
  const organization = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { tenantId: true },
  });
  if (invoice.party.tenantId !== organization.tenantId)
    throw new UserFacingError("Invoice customer belongs to another tenant.");
  if (invoice.project && invoice.project.organizationId !== organizationId)
    throw new UserFacingError(
      "Invoice project belongs to another organization.",
    );

  const eligible = ["APPROVED", "PARTIALLY_PAID", "PAID"].includes(
    invoice.status,
  );
  const decimals = await baseCurrencyDecimals(tx, organizationId);
  const baseNet = new Decimal(invoice.baseGrandTotal).sub(invoice.baseTaxTotal);
  const allocated = invoiceTaxLines({
    lines: invoice.lines,
    baseNet,
    baseTax: invoice.baseTaxTotal,
    baseWithholding: invoice.baseWithholdingTotal,
    decimals,
  });
  const lines: SourceJournalLine[] = [];
  if (eligible) {
    if (new Decimal(invoice.basePayableTotal).gt(0))
      lines.push({
        accountKey: "ACCOUNTS_RECEIVABLE",
        debit: invoice.basePayableTotal,
        credit: new Decimal(0),
        partyId: invoice.partyId,
        projectId: invoice.projectId,
      });
    if (baseNet.gt(0))
      lines.push({
        accountKey: "SALES_REVENUE",
        debit: new Decimal(0),
        credit: baseNet,
        projectId: invoice.projectId,
      });
    for (const tax of allocated.taxes) {
      const amount = new Decimal(tax.amount);
      if (amount.isZero()) continue;
      lines.push({
        accountKey: tax.isWithholding ? "WITHHOLDING_RECEIVABLE" : "OUTPUT_TAX",
        debit: tax.isWithholding ? amount : new Decimal(0),
        credit: tax.isWithholding ? new Decimal(0) : amount,
        partyId: invoice.partyId,
        projectId: invoice.projectId,
        taxComponentId: tax.componentId,
        taxName: tax.name,
        taxRate: tax.rate,
        taxBaseAmount: tax.taxBaseAmount,
      });
    }
    const debit = lines.reduce(
      (sum, line) => sum.add(line.debit),
      new Decimal(0),
    );
    const credit = lines.reduce(
      (sum, line) => sum.add(line.credit),
      new Decimal(0),
    );
    const residual = checkedPostingAdjustment(debit, credit, decimals);
    if (residual.gt(0)) {
      lines.push({
        accountKey: "ROUNDING",
        debit: debit.gt(credit) ? new Decimal(0) : residual,
        credit: debit.gt(credit) ? residual : new Decimal(0),
        projectId: invoice.projectId,
        description: "Invoice base rounding",
      });
    }
  }
  return syncSourceJournal(tx, {
    organizationId,
    actorId,
    sourceType: "SALES_INVOICE",
    sourceId: invoice.id,
    date: invoice.date,
    description: `${invoice.code} sales invoice`,
    lines,
  });
}
