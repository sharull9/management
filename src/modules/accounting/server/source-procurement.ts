import { Decimal } from "@/core/decimal";
import { UserFacingError } from "@/core/errors";
import type { Prisma } from "@/generated/prisma/client";
import {
  billReceiptAmounts,
  checkedPostingAdjustment,
  roundedBase,
} from "../invoice-postings";
import { lockAccountingScope } from "./locking";
import type { SourceJournalLine } from "./posting-service";
import { removeSourceJournal, syncSourceJournal } from "./posting-service";
import { baseCurrencyDecimals, invoiceTaxLines } from "./source-tax";

type DecimalValue = InstanceType<typeof Decimal>;
type ReceiptPortion = {
  receiptLineId: string;
  qty: DecimalValue;
  accrual: DecimalValue;
};

async function lockPurchaseOrderAllocations(
  tx: Prisma.TransactionClient,
  purchaseOrderId: string | null,
) {
  if (!purchaseOrderId) return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`vendor-bill-allocation:${purchaseOrderId}`}))::text`;
}

async function acceptedReceiptPortions(
  tx: Prisma.TransactionClient,
  organizationId: string,
  billId: string,
  billDate: Date,
  purchaseOrderId: string | null,
  decimals: number,
  billLines: {
    id: string;
    poLineId: string | null;
    grnLineId: string | null;
    qty: Prisma.Decimal;
  }[],
) {
  const result = new Map<string, ReceiptPortion[]>();
  if (!purchaseOrderId) return result;
  await lockPurchaseOrderAllocations(tx, purchaseOrderId);
  const receiptLines = await tx.goodsReceiptLine.findMany({
    where: {
      poLine: { orderId: purchaseOrderId },
      receipt: { organizationId, status: "APPROVED" },
    },
    include: { receipt: { select: { id: true, receivedDate: true } } },
    orderBy: [{ receipt: { receivedDate: "asc" } }, { id: "asc" }],
  });
  const movements = await tx.stockMovement.findMany({
    where: {
      organizationId,
      type: "GRN_IN",
      sourceType: "GRN",
      sourceId: { in: receiptLines.map((line) => line.id) },
    },
    select: { sourceId: true, totalCost: true },
  });
  const movementByReceiptLine = new Map(
    movements.map((movement) => [
      movement.sourceId,
      new Decimal(movement.totalCost).abs(),
    ]),
  );

  const otherBills = await tx.vendorBillLine.findMany({
    where: {
      poLine: { orderId: purchaseOrderId },
      billId: { not: billId },
      bill: {
        organizationId,
        status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] },
      },
    },
    include: { bill: { select: { date: true, id: true } } },
    orderBy: [{ bill: { date: "asc" } }, { billId: "asc" }, { id: "asc" }],
  });
  const all = [
    ...otherBills.map((line) => ({ ...line, current: false })),
    ...[...billLines]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((line) => ({
        ...line,
        bill: { date: billDate, id: billId },
        current: true,
      })),
  ].sort(
    (a, b) =>
      a.bill.date.getTime() - b.bill.date.getTime() ||
      a.bill.id.localeCompare(b.bill.id) ||
      a.id.localeCompare(b.id),
  );
  const used = new Map<string, DecimalValue>();
  const explicitlyLinked = all.filter((line) => line.grnLineId !== null);
  const generic = all.filter((line) => line.grnLineId === null);

  for (const line of [...explicitlyLinked, ...generic]) {
    const ordered = line.grnLineId
      ? receiptLines.filter((receipt) => receipt.id === line.grnLineId)
      : receiptLines.filter((receipt) => receipt.poLineId === line.poLineId);
    let remaining = new Decimal(line.qty);
    const portions: ReceiptPortion[] = [];
    for (const receipt of ordered) {
      const accepted = new Decimal(receipt.acceptedQty);
      const already = used.get(receipt.id) ?? new Decimal(0);
      const available = Decimal.max(0, accepted.sub(already));
      const qty = Decimal.min(remaining, available);
      if (!qty.gt(0)) continue;
      used.set(receipt.id, already.add(qty));
      remaining = remaining.sub(qty);
      if (line.current) {
        const movementValue =
          movementByReceiptLine.get(receipt.id) ?? new Decimal(0);
        const accrual = accepted.gt(0)
          ? roundedBase(
              movementValue.mul(already.add(qty)).div(accepted),
              decimals,
            ).sub(
              roundedBase(movementValue.mul(already).div(accepted), decimals),
            )
          : new Decimal(0);
        portions.push({ receiptLineId: receipt.id, qty, accrual });
      }
      if (remaining.isZero()) break;
    }
    if (line.current) result.set(line.id, portions);
  }
  return result;
}

export async function syncPurchaseOrderVendorBillJournals(
  tx: Prisma.TransactionClient,
  organizationId: string,
  purchaseOrderId: string,
  actorId: string,
) {
  await lockAccountingScope(tx, organizationId);
  await lockPurchaseOrderAllocations(tx, purchaseOrderId);
  const bills = await tx.vendorBill.findMany({
    where: {
      organizationId,
      purchaseOrderId,
      status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] },
    },
    select: { id: true },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  for (const bill of bills)
    await syncVendorBillJournal(tx, organizationId, bill.id, actorId);
}

export async function syncVendorBillJournal(
  tx: Prisma.TransactionClient,
  organizationId: string,
  billId: string,
  actorId: string,
) {
  await lockAccountingScope(tx, organizationId);
  const bill = await tx.vendorBill.findFirst({
    where: { id: billId, organizationId },
    include: {
      lines: { include: { taxes: true } },
      party: { select: { tenantId: true } },
      organization: { select: { tenantId: true } },
    },
  });
  if (!bill)
    return removeSourceJournal(tx, {
      organizationId,
      actorId,
      sourceType: "VENDOR_BILL",
      sourceId: billId,
      description: "Removed vendor bill",
    });
  if (bill.party.tenantId !== bill.organization.tenantId)
    throw new UserFacingError("Bill vendor belongs to another tenant.");
  const eligible = ["APPROVED", "PARTIALLY_PAID", "PAID"].includes(bill.status);
  const decimals = await baseCurrencyDecimals(tx, organizationId);
  const baseNet = new Decimal(bill.baseGrandTotal).sub(bill.baseTaxTotal);
  const allocations = invoiceTaxLines({
    lines: bill.lines,
    baseNet,
    baseTax: bill.baseTaxTotal,
    baseWithholding: bill.baseWithholdingTotal,
    decimals,
  });
  const receiptPortions = eligible
    ? await acceptedReceiptPortions(
        tx,
        organizationId,
        bill.id,
        bill.date,
        bill.purchaseOrderId,
        decimals,
        bill.lines,
      )
    : new Map<string, ReceiptPortion[]>();
  const lines: SourceJournalLine[] = [];
  if (eligible) {
    for (const [index, billLine] of bill.lines.entries()) {
      const billedNet = new Decimal(allocations.lineNet[index] ?? 0);
      const portions = receiptPortions.get(billLine.id) ?? [];
      const acceptedQty = portions.reduce(
        (sum, portion) => sum.add(portion.qty),
        new Decimal(0),
      );
      const acceptedNet = billLine.qty.gt(0)
        ? roundedBase(billedNet.mul(acceptedQty).div(billLine.qty), decimals)
        : new Decimal(0);
      const accrual = roundedBase(
        portions.reduce(
          (sum, portion) => sum.add(portion.accrual),
          new Decimal(0),
        ),
        decimals,
      );
      const unmatchedNet = billedNet.sub(acceptedNet);
      if (accrual.gt(0))
        lines.push({
          accountKey: "GRNI",
          debit: accrual,
          credit: new Decimal(0),
          partyId: bill.partyId,
          projectId: bill.projectId,
          description: `${billLine.description}: accepted receipt accrual`,
        });
      const { variance } = billReceiptAmounts(acceptedNet, accrual);
      if (variance.gt(0))
        lines.push({
          accountKey: "PURCHASE_VARIANCE",
          debit: variance,
          credit: new Decimal(0),
          partyId: bill.partyId,
          projectId: bill.projectId,
          description: `${billLine.description}: price/FX variance`,
        });
      else if (variance.lt(0))
        lines.push({
          accountKey: "PURCHASE_VARIANCE",
          debit: new Decimal(0),
          credit: variance.abs(),
          partyId: bill.partyId,
          projectId: bill.projectId,
          description: `${billLine.description}: price/FX variance`,
        });
      if (unmatchedNet.gt(0))
        lines.push({
          accountKey: "OTHER_EXPENSE",
          debit: unmatchedNet,
          credit: new Decimal(0),
          partyId: bill.partyId,
          projectId: bill.projectId,
          description: `${billLine.description}: unmatched/rejected purchase`,
        });
    }
    for (const tax of allocations.taxes) {
      const amount = new Decimal(tax.amount);
      if (amount.isZero()) continue;
      lines.push({
        accountKey: tax.isWithholding ? "WITHHOLDING_PAYABLE" : "INPUT_TAX",
        debit: tax.isWithholding ? new Decimal(0) : amount,
        credit: tax.isWithholding ? amount : new Decimal(0),
        partyId: bill.partyId,
        projectId: bill.projectId,
        taxComponentId: tax.componentId,
        taxName: tax.name,
        taxRate: tax.rate,
        taxBaseAmount: tax.taxBaseAmount,
      });
    }
    if (new Decimal(bill.basePayableTotal).gt(0))
      lines.push({
        accountKey: "ACCOUNTS_PAYABLE",
        debit: new Decimal(0),
        credit: bill.basePayableTotal,
        partyId: bill.partyId,
        projectId: bill.projectId,
      });
    const debit = lines.reduce(
      (sum, line) => sum.add(line.debit),
      new Decimal(0),
    );
    const credit = lines.reduce(
      (sum, line) => sum.add(line.credit),
      new Decimal(0),
    );
    const residual = checkedPostingAdjustment(debit, credit, decimals);
    if (residual.gt(0))
      lines.push({
        accountKey: "ROUNDING",
        debit: debit.gt(credit) ? new Decimal(0) : residual,
        credit: debit.gt(credit) ? residual : new Decimal(0),
        projectId: bill.projectId,
        description: "Bill base rounding",
      });
  }
  return syncSourceJournal(tx, {
    organizationId,
    actorId,
    sourceType: "VENDOR_BILL",
    sourceId: bill.id,
    date: bill.date,
    description: `${bill.code} vendor bill`,
    lines,
  });
}
