import { UserFacingError } from "@/core/errors";
import "server-only";
import { Decimal } from "@/core/decimal";
import type { Prisma } from "@/generated/prisma/client";
import {
  allocationPosting,
  documentSettlementRoundingPosting,
  paymentPosting,
  paymentRoundingPosting,
} from "../payment-postings";
import { lockAccountingScope } from "./locking";
import { removeSourceJournal, syncSourceJournal } from "./posting-service";

type Tx = Prisma.TransactionClient;
const utcDay = (value: Date) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
const later = (...dates: Date[]) =>
  utcDay(new Date(Math.max(...dates.map((d) => utcDay(d).getTime()))));

async function hasSource(
  tx: Tx,
  organizationId: string,
  sourceType: string,
  sourceId: string,
) {
  return tx.accountingSource.findUnique({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId,
        sourceType,
        sourceId,
      },
    },
    select: { id: true, fingerprint: true, currentEntryId: true },
  });
}

export async function syncPaymentJournals(
  tx: Tx,
  organizationId: string,
  paymentId: string,
  actorId: string,
) {
  await lockAccountingScope(tx, organizationId);
  const payment = await tx.payment.findFirst({
    where: { id: paymentId, organizationId },
    include: {
      allocations: {
        include: {
          vendorBill: {
            select: {
              id: true,
              organizationId: true,
              date: true,
              payableTotal: true,
              basePayableTotal: true,
            },
          },
          salesInvoice: {
            select: {
              id: true,
              organizationId: true,
              date: true,
              payableTotal: true,
              basePayableTotal: true,
            },
          },
        },
      },
      organization: {
        select: { baseCurrencyRef: { select: { decimals: true } } },
      },
    },
  });
  if (!payment) {
    return removeSourceJournal(tx, {
      organizationId,
      actorId,
      sourceType: "PAYMENT",
      sourceId: paymentId,
      description: "Removed payment",
    });
  }
  for (const a of payment.allocations) {
    const doc = a.vendorBill ?? a.salesInvoice;
    if (!doc || doc.organizationId !== organizationId)
      throw new UserFacingError(
        "Payment allocation document is outside this organization.",
      );
  }
  const date = utcDay(payment.date);
  const original = {
    organizationId,
    actorId,
    sourceType: "PAYMENT",
    sourceId: payment.id,
    date,
    description: `${payment.code} · ${payment.direction === "OUTGOING" ? "Payment" : "Receipt"}`,
    lines: paymentPosting({
      direction: payment.direction,
      mode: payment.mode,
      baseAmount: payment.baseAmount,
    }),
  };
  if (payment.status === "POSTED") await syncSourceJournal(tx, original);
  else {
    // Historical voids need an original and its reversal once; on retries the
    // source already exists, so never recreate a cleared current posting.
    if (!(await hasSource(tx, organizationId, "PAYMENT", payment.id)))
      await syncSourceJournal(tx, original);
    await syncSourceJournal(tx, {
      ...original,
      lines: [],
      reversalDate: later(payment.date, payment.updatedAt),
    });
  }

  const allocationTotals: string[] = [];
  const settlementDocuments = new Map<
    string,
    {
      kind: "VENDOR_BILL" | "SALES_INVOICE";
      id: string;
      date: Date;
      payableTotal: Prisma.Decimal;
      basePayableTotal: Prisma.Decimal;
    }
  >();
  for (const allocation of payment.allocations) {
    const doc = allocation.vendorBill ?? allocation.salesInvoice;
    const docId = allocation.vendorBillId ?? allocation.salesInvoiceId;
    if (!doc || !docId)
      throw new UserFacingError("Payment allocation is missing its document.");
    const allocationDate = later(
      payment.date,
      doc.date,
      allocation.allocatedAt,
    );
    const source = {
      organizationId,
      actorId,
      sourceType: "PAYMENT_ALLOCATION",
      sourceId: allocation.id,
      date: allocationDate,
      description: `${payment.code} allocation`,
      lines: allocationPosting({
        direction: payment.direction,
        baseAmount: allocation.baseAmount,
        documentBaseAmount: allocation.documentBaseAmount,
        fxDifference: allocation.fxDifference,
      }),
    };
    allocationTotals.push(String(allocation.baseAmount));
    const kind = allocation.vendorBillId ? "VENDOR_BILL" : "SALES_INVOICE";
    settlementDocuments.set(`${kind}:${docId}`, {
      kind,
      id: docId,
      date: doc.date,
      payableTotal: doc.payableTotal,
      basePayableTotal: doc.basePayableTotal,
    });
    if (payment.status === "POSTED") await syncSourceJournal(tx, source);
    else {
      if (
        !(await hasSource(
          tx,
          organizationId,
          "PAYMENT_ALLOCATION",
          allocation.id,
        ))
      )
        await syncSourceJournal(tx, source);
      await syncSourceJournal(tx, {
        ...source,
        lines: [],
        reversalDate: later(allocationDate, payment.updatedAt),
      });
    }
    // Ensure the referenced document identifier was the same-org row fetched above.
  }
  const fullyAllocated =
    payment.allocations.length > 0 &&
    payment.allocations
      .reduce((sum, a) => sum.add(a.amount), new Decimal(0))
      .eq(payment.amount);
  {
    const lines = paymentRoundingPosting({
      direction: payment.direction,
      paymentBaseAmount: payment.baseAmount,
      allocationBaseAmounts: allocationTotals,
      decimals: payment.organization.baseCurrencyRef.decimals,
      fullyAllocated,
    });
    if (lines) {
      const allocationDates = payment.allocations.map((a) => {
        const documentDate = a.vendorBill?.date ?? a.salesInvoice?.date;
        if (!documentDate)
          throw new UserFacingError(
            "Payment allocation is missing its document.",
          );
        return later(payment.date, documentDate, a.allocatedAt);
      });
      const rounding = {
        organizationId,
        actorId,
        sourceType: "PAYMENT_ROUNDING",
        sourceId: payment.id,
        date: later(...allocationDates),
        description: `${payment.code} allocation rounding`,
        lines,
      };
      if (payment.status === "POSTED") await syncSourceJournal(tx, rounding);
      else {
        if (
          !(await hasSource(tx, organizationId, "PAYMENT_ROUNDING", payment.id))
        )
          await syncSourceJournal(tx, rounding);
        await syncSourceJournal(tx, {
          ...rounding,
          lines: [],
          reversalDate: later(rounding.date, payment.updatedAt),
        });
      }
    }
  }

  for (const document of settlementDocuments.values()) {
    const allocations = await tx.paymentAllocation.findMany({
      where: {
        ...(document.kind === "VENDOR_BILL"
          ? { vendorBillId: document.id }
          : { salesInvoiceId: document.id }),
        payment: { organizationId, status: "POSTED" },
      },
      select: {
        amount: true,
        documentBaseAmount: true,
        allocatedAt: true,
        payment: { select: { date: true } },
      },
    });
    const fullySettled = allocations
      .reduce((sum, allocation) => sum.add(allocation.amount), new Decimal(0))
      .eq(document.payableTotal);
    const lines = documentSettlementRoundingPosting({
      direction: document.kind === "VENDOR_BILL" ? "OUTGOING" : "INCOMING",
      documentBaseAmount: document.basePayableTotal,
      allocationDocumentBaseAmounts: allocations.map(
        (allocation) => allocation.documentBaseAmount,
      ),
      decimals: payment.organization.baseCurrencyRef.decimals,
      fullySettled,
    });
    const sourceId = `${document.kind}:${document.id}`;
    const date = later(
      document.date,
      ...allocations.flatMap((allocation) => [
        allocation.payment.date,
        allocation.allocatedAt,
      ]),
    );
    await syncSourceJournal(tx, {
      organizationId,
      actorId,
      sourceType: "PAYMENT_DOCUMENT_ROUNDING",
      sourceId,
      date,
      reversalDate: later(date, payment.updatedAt),
      description: `${document.kind === "VENDOR_BILL" ? "Bill" : "Invoice"} settlement rounding`,
      lines: lines ?? [],
    });
  }
}
