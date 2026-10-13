import "server-only";
import type { z } from "zod";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import { organizationBaseCurrency } from "@/modules/currency/server/rates";
import { roundMoney } from "@/modules/currency/util";
import type { allocationsInput } from "../schema";
import {
  allocationFx,
  amount,
  Decimal,
  settlementStatus,
  validateAllocation,
} from "./allocation";

type Tx = Prisma.TransactionClient;

import { audit, lockSettlement, scope, target } from "./service";
export async function recomputeDocument(
  tx: Tx,
  direction: string,
  documentId: string,
) {
  if (direction === "OUTGOING") {
    const row = await tx.vendorBill.findUniqueOrThrow({
      where: { id: documentId },
    });
    const sum = await tx.paymentAllocation.aggregate({
      where: { vendorBillId: documentId, payment: { status: "POSTED" } },
      _sum: { amount: true },
    });
    const total = sum._sum.amount ?? new Decimal(0);
    await tx.vendorBill.update({
      where: { id: row.id },
      data: {
        paidTotal: total,
        status: settlementStatus(row.payableTotal, total),
      },
    });
  } else {
    const row = await tx.salesInvoice.findUniqueOrThrow({
      where: { id: documentId },
    });
    const sum = await tx.paymentAllocation.aggregate({
      where: { salesInvoiceId: documentId, payment: { status: "POSTED" } },
      _sum: { amount: true },
    });
    const total = sum._sum.amount ?? new Decimal(0);
    await tx.salesInvoice.update({
      where: { id: row.id },
      data: {
        receivedTotal: total,
        status: settlementStatus(row.payableTotal, total),
      },
    });
  }
}
export async function allocatePayment(
  tx: Tx,
  ctx: OrgContext,
  paymentId: string,
  allocations: z.infer<typeof allocationsInput>,
) {
  if (new Set(allocations.map((a) => a.documentId)).size !== allocations.length)
    throw new Error("Select each document once.");
  await lockSettlement(tx, ctx.org.id);
  const payment = await tx.payment.findFirstOrThrow({
    where: { id: paymentId, organizationId: ctx.org.id, status: "POSTED" },
  });
  await scope(tx, ctx, payment.projectId, "payment.record");
  const base = await organizationBaseCurrency(tx, ctx.org.id);
  const { decimals } = await tx.currency.findUniqueOrThrow({
    where: { code: payment.currency },
    select: { decimals: true },
  });
  let available = new Decimal(payment.unallocatedAmount);
  const checked = [];
  for (const a of allocations) {
    const { row, outstanding } = await target(
      tx,
      ctx,
      payment,
      a.documentId,
      "payment.record",
    );
    // Allocation inputs round to the payment currency's own decimals.
    const value = validateAllocation(
      available,
      outstanding,
      roundMoney(amount(a.amount), decimals),
    );
    available = available.sub(value);
    // The payment's own rate prices the cash side (advances keep the advance's
    // rate); the document's stored rate prices what it carried.
    const fx = allocationFx({
      amount: value,
      paymentCurrency: payment.currency,
      documentCurrency: row.currency,
      paymentRate: payment.exchangeRate,
      documentRate: row.exchangeRate,
      baseDecimals: base.decimals,
      direction: payment.direction,
    });
    checked.push({ ...a, value, fx });
  }
  for (const a of checked) {
    const allocation = await tx.paymentAllocation.create({
      data: {
        paymentId,
        amount: a.value,
        baseAmount: a.fx.baseAmount,
        documentBaseAmount: a.fx.documentBaseAmount,
        fxDifference: a.fx.fxDifference,
        allocatedById: ctx.user.id,
        ...(payment.direction === "OUTGOING"
          ? { vendorBillId: a.documentId }
          : { salesInvoiceId: a.documentId }),
      },
    });
    await recomputeDocument(tx, payment.direction, a.documentId);
    await audit(tx, ctx, "PaymentAllocation", allocation.id, "CREATE");
  }
  await tx.payment.update({
    where: { id: paymentId },
    data: {
      allocatedAmount: payment.amount.sub(available),
      unallocatedAmount: available,
    },
  });
  await audit(tx, ctx, "Payment", paymentId, "ALLOCATE");
}
